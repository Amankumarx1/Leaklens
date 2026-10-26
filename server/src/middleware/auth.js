import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import { errorResponse } from '../utils/apiResponse.js';

export const ROLES = {
  ADMIN: 'ADMIN',
  ANALYST: 'ANALYST',
  COMPLIANCE_REVIEWER: 'COMPLIANCE_REVIEWER'
};

/**
 * Middleware: Verifies authenticated JWT session from cookie or Authorization header.
 */
export function authenticateToken(req, res, next) {
  let token = null;

  // Check HttpOnly Cookie
  if (req.cookies && req.cookies.leaklens_token) {
    token = req.cookies.leaklens_token;
  }
  // Check Authorization Bearer Header
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.substring(7);
  }

  if (!token) {
    return errorResponse(res, 'Authentication required to access this resource.', 'UNAUTHORIZED', 401);
  }

  try {
    const decoded = jwt.verify(token, env.SESSION_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return errorResponse(
      res,
      isExpired ? 'Session expired. Please sign in again.' : 'Invalid authentication session.',
      isExpired ? 'SESSION_EXPIRED' : 'INVALID_TOKEN',
      401
    );
  }
}

/**
 * Middleware: Enforces backend Role-Based Access Control.
 * @param {string[]} allowedRoles - List of permitted roles (e.g. ['ADMIN', 'ANALYST'])
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required.', 'UNAUTHORIZED', 401);
    }

    const userRole = (req.user.role || '').toUpperCase();
    const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());

    if (!normalizedAllowed.includes(userRole)) {
      return errorResponse(
        res,
        `Access denied. Role "${req.user.role}" lacks required permissions for this operation.`,
        'FORBIDDEN',
        403
      );
    }

    next();
  };
}

export default {
  authenticateToken,
  requireRole,
  ROLES
};
