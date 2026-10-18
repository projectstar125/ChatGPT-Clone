// In-memory limiter is suitable only for a single process. Use Redis/Upstash for multi-instance production.
const buckets = new Map<string, { count: number; reset: number }>();
export function rateLimit(key: string, limit = 20, windowMs = 60_000) {
  const now = Date.now(); let bucket = buckets.get(key);
  if (!bucket || bucket.reset <= now) { bucket = { count: 0, reset: now + windowMs }; buckets.set(key, bucket); }
  bucket.count++;
  return { allowed: bucket.count <= limit, retryAfter: Math.max(1, Math.ceil((bucket.reset - now) / 1000)) };
}
