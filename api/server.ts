import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth';
import resumeRoutes from './routes/resume';
import jobRoutes from './routes/job';
import vendorRoutes from './routes/vendor';
import { corsOptions } from './config/cors';

// Load environment variables
dotenv.config();

// Fail fast on missing configuration — never fall back to a local dev DB in
// production (a silent localhost fallback previously made this guard dead code).
const MONGODB_URI =
  process.env.MONGODB_URI ||
  (process.env.NODE_ENV === 'production' ? undefined : 'mongodb://localhost:27017/test');

if (!MONGODB_URI) {
  console.error('FATAL: MONGODB_URI is not set');
  process.exit(1);
}

// Express app setup
const app = express();
const PORT = process.env.PORT || 5001;

// Behind a proxy (nginx/ALB/Render), trust exactly one hop so rate limiting
// keys on the real client IP instead of the proxy IP.
app.set('trust proxy', 1);

// Single CORS layer — explicit origin allowlist (see config/cors.ts).
app.use(cors(corsOptions));

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/api/health',
});
app.use(limiter);

// Stricter limit for auth endpoints (login/profile/role traffic)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/auth', authLimiter);

// JSON body parsers. Two endpoints legitimately carry large payloads (base64
// resume upload, AI match analysis), so their route-scoped parsers run FIRST
// and claim those paths; everything else gets the tight 1mb default. (The old
// 50mb global limit was a free memory-exhaustion DoS.)
app.use('/api/resumes/analyze', express.json({ limit: '15mb' }));
app.use('/api/jobs/match-analysis', express.json({ limit: '5mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Root endpoint - health check (reports DB readiness)
app.get('/api/health', (req: Request, res: Response) => {
  const dbReady = mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({
    status: dbReady ? 'ok' : 'degraded',
    message: 'API is running',
    database: dbReady ? 'connected' : 'disconnected',
  });
});

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/resumes', resumeRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/vendors', vendorRoutes);

// 404 handler (registered before the error handler so later routes are covered)
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) {
    return next(err);
  }

  // Body-parser failures
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Payload too large' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  // Malformed ObjectId params
  if (err?.name === 'CastError') {
    return res.status(400).json({ error: 'Invalid id' });
  }
  // Mongoose validation failures
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ error: 'Validation failed', details: err.message });
  }
  // Duplicate key
  if (err?.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value' });
  }

  // Never leak internal error details to clients
  console.error(err);
  const status = err?.status || err?.statusCode || 500;
  res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
});

// Initialize MongoDB connection
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Run database initialization checks
    try {
      const { initializeDatabase } = await import('./utils/db-init');
      await initializeDatabase();
    } catch (initError) {
      console.error('Error during database initialization:', initError);
    }
    
    // Start the server after DB checks are complete
    const server = app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`CORS enabled for frontend access`);
    });

    // Timeouts: avoid slowloris holding connections open forever. 120s leaves
    // room for large resume uploads + AI analysis while staying bounded.
    server.headersTimeout = 30 * 1000;
    server.requestTimeout = 120 * 1000;

    // Graceful shutdown: stop accepting connections, drain in-flight requests,
    // then close the DB connection so deploys don't kill active work.
    const shutdown = (signal: string) => {
      console.log(`${signal} received, shutting down gracefully`);
      server.close(async () => {
        try {
          await mongoose.disconnect();
        } catch (e) {
          console.error('Error disconnecting from MongoDB:', e);
        }
        process.exit(0);
      });
      // Force-exit if draining hangs
      setTimeout(() => process.exit(1), 10 * 1000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('unhandledRejection', (reason) => {
      console.error('Unhandled rejection:', reason);
    });
    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err);
      shutdown('uncaughtException');
    });
  })
  .catch((err: Error) => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

export default app;
