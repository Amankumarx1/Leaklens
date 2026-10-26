import { errorResponse } from '../utils/apiResponse.js';

/**
 * 404 Handler for Unknown API Routes
 */
export function notFoundHandler(req, res) {
  return errorResponse(
    res,
    `Route ${req.method} ${req.originalUrl} not found on this server`,
    'RESOURCE_NOT_FOUND',
    404
  );
}

export default notFoundHandler;
