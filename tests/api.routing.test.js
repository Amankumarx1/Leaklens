import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';

describe('Routing & Error Prevention', () => {
  const app = createApp();

  it('should return 404 with standardized error response for unknown API routes', async () => {
    const res = await request(app).get('/api/unknown-security-endpoint-xyz');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    expect(res.body.error.message).toContain('not found');
  });

  it('should return 200 with under-development phase notice for placeholder endpoints', async () => {
    const endpoints = ['/api/scans', '/api/findings', '/api/incidents', '/api/analytics', '/api/audit-logs'];

    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toContain('Under Development');
      expect(res.body.data.phase).toContain('Phase 1');
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
