/**
 * Sliding-Window In-Memory Rate Limiter Middleware
 * Protects endpoints from brute-force authentication attempts, API abuse, and scanner DoS.
 * Conforms to IETF draft standard rate-limiting headers:
 * - RateLimit-Limit
 * - RateLimit-Remaining
 * - RateLimit-Reset
 * - Retry-After
 */

class SlidingWindowRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000; // 1 minute default
    this.max = options.max || 100; // 100 requests per window
    this.message = options.message || 'Too many requests from this IP, please try again later.';
    this.keyGenerator = options.keyGenerator || (req => req.ip || req.socket?.remoteAddress || 'unknown');
    this.skip = options.skip || (() => false);
    
    // IP/Key -> Array of timestamps [t1, t2, ...]
    this.hits = new Map();

    // Periodic sweep every 60s to prune dormant clients and prevent memory bloat
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, timestamps] of this.hits.entries()) {
        const validTimestamps = timestamps.filter(t => now - t < this.windowMs);
        if (validTimestamps.length === 0) {
          this.hits.delete(key);
        } else {
          this.hits.set(key, validTimestamps);
        }
      }
    }, Math.max(this.windowMs, 30000)).unref();
  }

  middleware() {
    return (req, res, next) => {
      // Allow custom skip (e.g. test environment or health pings)
      if (this.skip(req)) {
        return next();
      }

      const key = this.keyGenerator(req);
      const now = Date.now();
      const windowStart = now - this.windowMs;

      let timestamps = this.hits.get(key) || [];
      // Filter out timestamps outside current sliding window
      timestamps = timestamps.filter(t => t > windowStart);

      const currentCount = timestamps.length;
      const remaining = Math.max(0, this.max - (currentCount + 1));
      const resetSeconds = Math.ceil((this.windowMs - (now - (timestamps[0] || now))) / 1000);

      res.setHeader('RateLimit-Limit', this.max);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', resetSeconds);

      if (currentCount >= this.max) {
        res.setHeader('Retry-After', resetSeconds);
        return res.status(429).json({
          success: false,
          error: this.message,
          retryAfterSeconds: resetSeconds
        });
      }

      // Record this request
      timestamps.push(now);
      this.hits.set(key, timestamps);

      next();
    };
  }

  reset() {
    this.hits.clear();
  }

  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.hits.clear();
  }
}

/**
 * Creates an Express rate-limiting middleware instance.
 */
export function createRateLimiter(options = {}) {
  const limiter = new SlidingWindowRateLimiter(options);
  const fn = limiter.middleware();
  fn.limiterInstance = limiter;
  return fn;
}

// 1. Strict Authentication Limiter: max 10 failed/attempted logins per minute per IP
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts. Please wait 60 seconds before trying again.',
  skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITER
});

// 2. Scanner Upload Limiter: max 30 file scans per minute per IP
export const scanUploadRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Scanning throughput limit reached (max 30 files/minute). Please wait before scanning again.',
  skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITER
});

// 3. General Cloud Management Limiter: max 60 integration actions per minute per IP
export const integrationRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'Cloud management request rate exceeded. Please slow down requests.',
  skip: () => process.env.NODE_ENV === 'test' && !process.env.TEST_RATE_LIMITER
});

export default {
  createRateLimiter,
  authRateLimiter,
  scanUploadRateLimiter,
  integrationRateLimiter
};
