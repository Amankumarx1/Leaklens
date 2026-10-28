import crypto from 'crypto';

/**
 * Security-Conscious Request Logger Middleware
 * Logs incoming HTTP transactions without recording passwords, tokens,
 * authorization headers, or sensitive file data.
 * Sets X-Request-ID and X-Response-Time headers for telemetry correlation.
 */

const SENSITIVE_KEYS = new Set([
  'password',
  'password_hash',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'session_secret',
  'secret',
  'secret_key',
  'api_key',
  'private_key',
  'file_content',
  'content'
]);

/**
 * Recursively redacts sensitive keys from an object for logging.
 */
function sanitizeObject(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function requestLogger(req, res, next) {
  const start = process.hrtime();
  const timestamp = new Date().toISOString();

  // Attach and propagate correlation request ID
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  // Hook writeHead to inject accurate X-Response-Time before headers are flushed
  const originalWriteHead = res.writeHead;
  res.writeHead = function (...args) {
    if (!res.headersSent) {
      const [seconds, nanoseconds] = process.hrtime(start);
      const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
      res.setHeader('X-Response-Time', `${durationMs}ms`);
    }
    return originalWriteHead.apply(this, args);
  };

  // Redact incoming headers
  const sanitizedHeaders = { ...req.headers };
  delete sanitizedHeaders.authorization;
  delete sanitizedHeaders.cookie;
  delete sanitizedHeaders['x-api-key'];

  res.on('finish', () => {
    const [seconds, nanoseconds] = process.hrtime(start);
    const durationMs = (seconds * 1000 + nanoseconds / 1e6).toFixed(2);
    const status = res.statusCode;

    // Build structured log message
    const logData = {
      timestamp,
      method: req.method,
      url: req.originalUrl || req.url,
      status,
      durationMs: `${durationMs}ms`,
      ip: req.ip || req.socket.remoteAddress
    };

    // Only log in non-test environments
    if (process.env.NODE_ENV !== 'test') {
      const color = status >= 500 ? '\x1b[31m' : status >= 400 ? '\x1b[33m' : '\x1b[32m';
      const reset = '\x1b[0m';
      console.log(
        `[${logData.timestamp}] ${color}${logData.method} ${logData.url} ${logData.status}${reset} - ${logData.durationMs}`
      );
    }
  });

  next();
}

export { sanitizeObject };
export default requestLogger;
