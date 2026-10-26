import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';

describe('Operational Health API (GET /api/health)', () => {
  const app = createApp();

  it('should return 200 and operational health metadata', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const data = res.body.data;
    expect(data.status).toMatch(/^(healthy|degraded)$/);
    expect(data.version).toBe('1.0.0');
    expect(data.environment).toBeDefined();
    expect(typeof data.uptimeSeconds).toBe('number');
    expect(data.components.api.status).toBe('up');
    expect(data.components.database.status).toMatch(/^(connected|disconnected)$/);
  });

  it('should never expose database credentials or secrets in health check output', async () => {
    const res = await request(app).get('/api/health');
    const rawBodyString = JSON.stringify(res.body).toLowerCase();

    // Sensitive key leak check
    expect(rawBodyString).not.toContain('password');
    expect(rawBodyString).not.toContain('db_password');
    expect(rawBodyString).not.toContain('connectionstring');
    expect(rawBodyString).not.toContain('session_secret');
    expect(rawBodyString).not.toContain('user_id');
  });
});
