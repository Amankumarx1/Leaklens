import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/src/app.js';
import env from '../server/src/config/env.js';

describe('Authentication & Role-Based Access Control (RBAC)', () => {
  const app = createApp();

  it('should authenticate valid credentials and return JWT token and HttpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'analyst@leaklens.local',
        password: 'LeakLensDev2026!'
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('analyst@leaklens.local');
    expect(res.body.data.user.role).toBe('ANALYST');
    expect(res.body.data.token).toBeDefined();

    // Verify Set-Cookie header contains leaklens_token
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.includes('leaklens_token='))).toBe(true);
    expect(cookies.some(c => c.includes('HttpOnly'))).toBe(true);
  });

  it('should reject invalid password with generic 401 error message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'analyst@leaklens.local',
        password: 'WrongPassword123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('should reject non-existent user with identical generic 401 error message', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent.user@leaklens.local',
        password: 'SomePassword123!'
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe('Invalid email or password');
  });

  it('should retrieve current user profile from GET /api/auth/me via Bearer token', async () => {
    // Generate valid analyst token
    const token = jwt.sign(
      { user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', email: 'analyst@leaklens.local', role: 'ANALYST' },
      env.SESSION_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe('analyst@leaklens.local');
    expect(res.body.data.user.role).toBe('ANALYST');
  });

  it('should enforce that COMPLIANCE_REVIEWER cannot initiate scans (HTTP 403 Forbidden)', async () => {
    // Compliance Reviewer token
    const complianceToken = jwt.sign(
      { user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003', email: 'compliance@leaklens.local', role: 'COMPLIANCE_REVIEWER' },
      env.SESSION_SECRET,
      { expiresIn: '1h' }
    );

    // Attempt file upload
    const res = await request(app)
      .post('/api/scans')
      .set('Authorization', `Bearer ${complianceToken}`)
      .attach('file', Buffer.from('email=test@example.com'), 'sample.txt');

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('COMPLIANCE_REVIEWER');
  });

  it('should permit ANALYST and ADMIN roles to initiate scans', async () => {
    const analystToken = jwt.sign(
      { user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', email: 'analyst@leaklens.local', role: 'ANALYST' },
      env.SESSION_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/scans')
      .set('Authorization', `Bearer ${analystToken}`)
      .attach('file', Buffer.from('test string with email: lead@company.test'), 'authorized.txt');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scan_id).toBeDefined();
    expect(res.body.data.status).toBe('completed');
  });

  it('should clear session on POST /api/auth/logout', async () => {
    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some(c => c.includes('leaklens_token=;'))).toBe(true);
  });
});
