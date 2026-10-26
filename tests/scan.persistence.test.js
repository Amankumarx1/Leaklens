import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/src/app.js';
import env from '../server/src/config/env.js';

describe('End-to-End Scan Execution & Persistence Verification', () => {
  const app = createApp();

  const analystToken = jwt.sign(
    { user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', email: 'analyst@leaklens.local', role: 'ANALYST' },
    env.SESSION_SECRET,
    { expiresIn: '1h' }
  );

  let createdScanId = null;

  it('should upload a multi-exposure file and persist scan metadata and masked findings', async () => {
    const fileContent = [
      '# Corporate Application Secrets',
      'ADMIN_CONTACT=admin.dev@corp.internal',
      'API_PRIMARY_KEY=key_live_9a8b7c6d5e4f3a2b1029',
      '-----BEGIN RSA PRIVATE KEY-----',
      'TOKEN_ID=LL-ID-8831-2940'
    ].join('\n');

    const res = await request(app)
      .post('/api/scans')
      .set('Authorization', `Bearer ${analystToken}`)
      .attach('file', Buffer.from(fileContent), 'production_secrets.txt');

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    createdScanId = data.scan_id;
    expect(createdScanId).toBeDefined();
    expect(data.status).toBe('completed');
    expect(data.file.original_filename).toBe('production_secrets.txt');
    expect(data.file.content_hash).toBeDefined();
    expect(data.summary.total_findings).toBe(4);
    expect(data.summary.critical).toBe(1);
    expect(data.summary.high).toBe(1);
    expect(data.summary.medium).toBe(1);
    expect(data.summary.low).toBe(1);
  });

  it('should retrieve scan details by ID from GET /api/scans/:id', async () => {
    expect(createdScanId).toBeDefined();

    const res = await request(app)
      .get(`/api/scans/${createdScanId}`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scan_id).toBe(createdScanId);
    expect(res.body.data.status).toBe('completed');
    expect(res.body.data.original_filename).toBe('production_secrets.txt');
  });

  it('should retrieve persisted findings for the scan from GET /api/scans/:id/findings', async () => {
    expect(createdScanId).toBeDefined();

    const res = await request(app)
      .get(`/api/scans/${createdScanId}/findings`)
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBe(4);

    // Verify findings are masked and have locations
    const findings = res.body.data;
    expect(findings.every(f => typeof f.location_reference === 'string')).toBe(true);
    expect(findings.every(f => typeof f.masked_excerpt === 'string')).toBe(true);
    expect(findings.some(f => f.category === 'EMAIL_ADDRESS')).toBe(true);
    expect(findings.some(f => f.category === 'API_KEY_CANDIDATE')).toBe(true);
    expect(findings.some(f => f.category === 'PRIVATE_KEY_MARKER')).toBe(true);
    expect(findings.some(f => f.category === 'SENSITIVE_IDENTIFIER')).toBe(true);
  });

  it('should support server-side filtering of findings by severity', async () => {
    const res = await request(app)
      .get('/api/findings?severity=critical')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.every(f => f.severity === 'critical')).toBe(true);
  });

  it('should support server-side filtering of findings by category', async () => {
    const res = await request(app)
      .get('/api/findings?category=API_KEY_CANDIDATE')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.every(f => f.category === 'API_KEY_CANDIDATE')).toBe(true);
  });

  it('should return aggregated metrics reflecting real scans from GET /api/analytics/dashboard', async () => {
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.totalCompletedScans).toBeGreaterThanOrEqual(1);
    expect(res.body.data.totalFindings).toBeGreaterThanOrEqual(4);
    expect(res.body.data.findingsBySeverity.critical).toBeGreaterThanOrEqual(1);
    expect(res.body.data.findingsBySeverity.high).toBeGreaterThanOrEqual(1);
  });

  it('should record audit log trail for scan actions', async () => {
    const res = await request(app)
      .get('/api/audit-logs')
      .set('Authorization', `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const logs = res.body.data;
    expect(logs.some(l => l.event_type === 'scan_created')).toBe(true);
    expect(logs.some(l => l.event_type === 'scan_completed')).toBe(true);
  });
});
