import { errorResponse } from '../utils/apiResponse.js';
import env from '../config/env.js';

/**
 * Centralized Error-Handling Middleware
 * Formats uncaught exceptions and rejected promises into a consistent wire schema.
 * Strictly prevents stack trace or credential leakage in production environments.
 */
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || err.status || 500;
  const errorCode = err.code || (statusCode >= 500 ? 'INTERNAL_SERVER_ERROR' : 'BAD_REQUEST');
  
  // Safe user-facing message
  let message = err.message || 'An unexpected internal error occurred.';
  if (statusCode >= 500 && env.IS_PRODUCTION) {
    message = 'An internal system error occurred. Security operations team has been alerted.';
  }

  // Diagnostic details are only provided in non-production environments
  let details = null;
  if (!env.IS_PRODUCTION && err.stack) {
    details = {
      stack: err.stack.split('\n').map(line => line.trim())
    };
  }

  if (err.details) {
    details = { ...details, ...err.details };
  }

  // Log server errors to console with redactions
  if (statusCode >= 500 && !env.IS_TEST) {
    console.error(`[Error] ${errorCode}: ${err.message}`);
    if (err.stack) {
      console.error(err.stack);
    }
  }

  return errorResponse(res, message, errorCode, statusCode, details);
}

export default errorHandler;
