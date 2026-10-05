import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './authMiddleware';

// Per-user daily budget for AI endpoints (Gemini calls), so one account
// cannot burn unlimited API credit. In-memory like the rest of the rate
// limiting here: resets on restart, single-instance only.
const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS =
  Number(process.env.AI_DAILY_QUOTA) > 0 ? Number(process.env.AI_DAILY_QUOTA) : 50;

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

const pruneExpired = () => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
};

export const aiDailyQuota = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const now = Date.now();
  if (buckets.size > 10_000) pruneExpired();

  let bucket = buckets.get(uid);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(uid, bucket);
  }

  if (bucket.count >= MAX_REQUESTS) {
    const secondsLeft = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    res.setHeader('Retry-After', String(secondsLeft));
    return res.status(429).json({
      error: `Daily AI analysis limit of ${MAX_REQUESTS} reached. Try again in about ${Math.ceil(secondsLeft / 60)} minutes.`,
    });
  }

  bucket.count += 1;
  res.setHeader('X-AI-Quota-Remaining', String(MAX_REQUESTS - bucket.count));
  return next();
};
