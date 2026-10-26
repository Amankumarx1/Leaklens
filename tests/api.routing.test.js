import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';

describe('Routing & Access Control Foundation', () => {
  const app = createApp();

  it('should return 404 with standardized error response for unknown API routes', async () => {
    const res = await request(app).get('/api/unknown-security-endpoint-xyz');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.error.message).toContain('not found');
  });

  it('should require authentication (401) for protected domain routes', async () => {
    const protectedEndpoints = ['/api/scans', '/api/findings', '/api/incidents', '/api/analytics/dashboard', '/api/audit-logs'];

    for (const endpoint of protectedEndpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    }
  });

  it('should return 200 with under-development notice for Phase 4 placeholder endpoints', async () => {
    const endpoints = ['/api/rules'];

    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toContain('Under Development');
    }
  });

  it('should include CORS allow headers on requests', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});
