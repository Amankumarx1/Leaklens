import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import userRepository from '../repositories/userRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return errorResponse(res, 'Email and password are required', 'VALIDATION_ERROR', 400);
  }

  const user = await userRepository.findByEmail(email);

  if (!user) {
    // Record audit event for failed attempt without disclosing user non-existence
    await auditRepository.createAuditEntry({
      event_type: 'login_failed',
      entity_type: 'user',
      entity_id: email.toLowerCase(),
      metadata: { reason: 'invalid_credentials' }
    });
    return errorResponse(res, 'Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }

  if (!user.is_active) {
    return errorResponse(res, 'Account is deactivated. Contact an administrator.', 'ACCOUNT_DISABLED', 403);
  }

  const isPasswordValid = await bcrypt.compare(password, user.password_hash);
  if (!isPasswordValid) {
    await auditRepository.createAuditEntry({
      user_id: user.user_id,
      event_type: 'login_failed',
      entity_type: 'user',
      entity_id: user.user_id,
      metadata: { reason: 'invalid_credentials' }
    });
    return errorResponse(res, 'Invalid email or password', 'INVALID_CREDENTIALS', 401);
  }

  // Create JWT session
  const payload = {
    user_id: user.user_id,
    display_name: user.display_name,
    email: user.email,
    role: (user.role || 'ANALYST').toUpperCase()
  };

  const token = jwt.sign(payload, env.SESSION_SECRET, { expiresIn: '8h' });

  // Set HttpOnly Cookie
  res.cookie('leaklens_token', token, {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: env.IS_PRODUCTION ? 'strict' : 'lax',
    maxAge: 8 * 60 * 60 * 1000 // 8 hours
  });

  await auditRepository.createAuditEntry({
    user_id: user.user_id,
    event_type: 'login_success',
    entity_type: 'user',
    entity_id: user.user_id,
    metadata: { role: payload.role }
  });

  return successResponse(res, {
    user: payload,
    token
  }, null, 200);
}

export async function logout(req, res) {
  if (req.user) {
    await auditRepository.createAuditEntry({
      user_id: req.user.user_id,
      event_type: 'logout',
      entity_type: 'user',
      entity_id: req.user.user_id
    });
  }

  res.clearCookie('leaklens_token', {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: env.IS_PRODUCTION ? 'strict' : 'lax'
  });

  return successResponse(res, { message: 'Logged out successfully' }, null, 200);
}

export async function getProfile(req, res) {
  if (!req.user) {
    return errorResponse(res, 'Authentication required', 'UNAUTHORIZED', 401);
  }

  return successResponse(res, { user: req.user }, null, 200);
}

export default {
  login,
  logout,
  getProfile
};
