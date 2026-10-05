"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const auth_1 = __importDefault(require("./routes/auth"));
const resume_1 = __importDefault(require("./routes/resume"));
const job_1 = __importDefault(require("./routes/job"));
const vendor_1 = __importDefault(require("./routes/vendor"));
const cors_2 = require("./config/cors");
// Importing db.ts validates Supabase env (fail-fast in production) and creates
// the service-role client every controller shares.
const db_1 = require("./db");
// Load environment variables
dotenv_1.default.config();
// Express app setup
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5001;
// Behind a proxy (nginx/ALB/Render), trust exactly one hop so rate limiting
// keys on the real client IP instead of the proxy IP.
app.set('trust proxy', 1);
// Single CORS layer — explicit origin allowlist (see config/cors.ts).
app.use((0, cors_1.default)(cors_2.corsOptions));
// Security middleware
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // limit each IP to 500 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/api/health',
});
app.use(limiter);
// Stricter limit for auth endpoints (login/profile/role traffic)
const authLimiter = (0, express_rate_limit_1.default)({
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
app.use('/api/resumes/analyze', express_1.default.json({ limit: '15mb' }));
app.use('/api/jobs/match-analysis', express_1.default.json({ limit: '5mb' }));
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '100kb' }));
// Root endpoint - health check (verifies the Supabase connection with a
// trivial head query through the service-role client)
app.get('/api/health', async (req, res) => {
    let dbReady = false;
    try {
        const { error } = await db_1.supabaseAdmin
            .from('users')
            .select('uid', { count: 'exact', head: true });
        dbReady = !error;
        if (error)
            console.error('[HEALTH] Supabase check failed:', error.message);
    }
    catch (error) {
        console.error('[HEALTH] Supabase check threw:', error);
    }
    res.status(dbReady ? 200 : 503).json({
        status: dbReady ? 'ok' : 'degraded',
        message: 'API is running',
        database: dbReady ? 'connected' : 'disconnected',
    });
});
// Mount API routes
app.use('/api/auth', auth_1.default);
app.use('/api/resumes', resume_1.default);
app.use('/api/jobs', job_1.default);
app.use('/api/vendors', vendor_1.default);
// 404 handler (registered before the error handler so later routes are covered)
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }
    // Body-parser failures
    if ((err === null || err === void 0 ? void 0 : err.type) === 'entity.too.large') {
        return res.status(413).json({ error: 'Payload too large' });
    }
    if ((err === null || err === void 0 ? void 0 : err.type) === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON body' });
    }
    // Postgres errors surfaced from controllers: unique violation / check
    // violation / malformed uuid
    if ((err === null || err === void 0 ? void 0 : err.code) === '23505') {
        return res.status(409).json({ error: 'Duplicate value' });
    }
    if ((err === null || err === void 0 ? void 0 : err.code) === '23514' || (err === null || err === void 0 ? void 0 : err.code) === '22P02') {
        return res.status(400).json({ error: 'Validation failed', details: err.message });
    }
    // Never leak internal error details to clients
    console.error(err);
    const status = (err === null || err === void 0 ? void 0 : err.status) || (err === null || err === void 0 ? void 0 : err.statusCode) || 500;
    res.status(status).json({ error: status === 500 ? 'Something went wrong' : err.message });
});
// Start the server. There is no connection handshake to wait for: the
// Supabase client is stateless (HTTP) and every query is per-request.
const server = app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`CORS enabled for frontend access`);
});
// Timeouts: avoid slowloris holding connections open forever. 120s leaves
// room for large resume uploads + AI analysis while staying bounded.
server.headersTimeout = 30 * 1000;
server.requestTimeout = 120 * 1000;
// Graceful shutdown: stop accepting connections, then drain in-flight
// requests so deploys don't kill active work.
const shutdown = (signal) => {
    console.log(`${signal} received, shutting down gracefully`);
    server.close(() => {
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
exports.default = app;
