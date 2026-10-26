/**
 * Standardized API Response Utilities
 * Ensures consistent wire format across all LeakLens endpoints.
 */

/**
 * Formats and sends a success response.
 * @param {import('express').Response} res - Express response object
 * @param {any} data - Payload data
 * @param {object} [meta] - Optional pagination, query, or contextual metadata
 * @param {number} [statusCode=200] - HTTP status code
 */
export function successResponse(res, data = null, meta = null, statusCode = 200) {
  const payload = {
    success: true,
    data
  };

  if (meta && typeof meta === 'object') {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
}

/**
 * Formats and sends an error response.
 * @param {import('express').Response} res - Express response object
 * @param {string} message - Human-readable error summary
 * @param {string} [code='INTERNAL_ERROR'] - Machine-readable error code
 * @param {number} [statusCode=500] - HTTP status code
 * @param {any} [details=null] - Optional non-sensitive validation details
 */
export function errorResponse(res, message, code = 'INTERNAL_ERROR', statusCode = 500, details = null) {
  const payload = {
    success: false,
    error: {
      code,
      message
    }
  };

  if (details !== null && details !== undefined) {
    payload.error.details = details;
  }

  return res.status(statusCode).json(payload);
}
