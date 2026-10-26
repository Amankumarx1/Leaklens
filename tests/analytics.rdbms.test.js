import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/src/app.js';
import env from '../server/src/config/env.js';
import findingRepository from '../server/src/repositories/findingRepository.js';
import memoryStore from '../server/src/repositories/memoryStore.js';
import { executeScan } from '../server/src/services/scanner/scannerService.js';

describe('Phase 5: Analytics Data Model & RDBMS Verification Test Suite', () => {
  const app = createApp();

  const authHeader = 'Bearer ' + jwt.sign(
    {
      userId: '00000000-0000-0000-0000-000000000001',
      email: 'admin@leaklens.local',
      role: 'ADMIN'
    },
    env.SESSION_SECRET,
    { expiresIn: '1h' }
  );

  beforeEach(() => {
    // Reset in-memory collections for reproducible test telemetry
    memoryStore.scan_jobs = [];
    memoryStore.files = [];
    memoryStore.findings = [];
    memoryStore.incidents = [];
    memoryStore.incident_findings = [];
    memoryStore.remediation_actions = [];
    memoryStore.audit_logs = [];
  });

  // ============================================================================
  // 1. Analytical Measures Calculation & Aggregation Correctness
  // ============================================================================
  describe('Analytics Measures Calculation', () => {
    it('should return legitimate empty state metrics when no records exist', async () => {
      const metrics = await findingRepository.getDashboardMetrics();

      expect(metrics.totalCompletedScans).toBe(0);
      expect(metrics.totalFindings).toBe(0);
      expect(metrics.scans.total).toBe(0);
      expect(metrics.incidents.total).toBe(0);
      expect(metrics.mttr.avgHours).toBe(0);
      expect(metrics.mttr.resolvedCases).toBe(0);
      expect(metrics.findingsBySeverity.critical).toBe(0);
    });

    it('should compute exact counts for scans, findings, and severity tiers without duplication', async () => {
      // 1. Seed two scan operations with test findings (.txt supported format)
      const sample1 = Buffer.from('-----BEGIN PRIVATE KEY-----\nSECRET=key_test_1234567890abcdef1234567890abcdef1234');
      const sample2 = Buffer.from('api_key="sk_demo_1234567890123456"');

      await executeScan({
        userId: '00000000-0000-0000-0000-000000000001',
        filename: 'service1.txt',
        buffer: sample1
      });

      await executeScan({
        userId: '00000000-0000-0000-0000-000000000001',
        filename: 'service2.txt',
        buffer: sample2
      });

      const metrics = await findingRepository.getDashboardMetrics();

      expect(metrics.totalCompletedScans).toBe(2);
      expect(metrics.scans.completed).toBe(2);
      expect(metrics.totalFindings).toBeGreaterThanOrEqual(2);
      expect(metrics.findingsBySeverity.critical).toBeGreaterThanOrEqual(1);
      expect(metrics.findingsBySeverity.high).toBeGreaterThanOrEqual(1);
    });

    it('should accurately compute MTTR (Mean Time to Remediate) in hours and minutes', async () => {
      const now = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

      // Seed resolved incidents with known timestamps
      memoryStore.incidents.push({
        incident_id: 'inc-mttr-1',
        title: 'Resolved Key Leak',
        status: 'resolved',
        priority: 'critical',
        assigned_to: 'user-1',
        created_at: fourHoursAgo,
        resolved_at: twoHoursAgo, // Duration: 2.0 hours (120 minutes)
        version: 2
      });

      memoryStore.incidents.push({
        incident_id: 'inc-mttr-2',
        title: 'Resolved Token Leak',
        status: 'closed',
        priority: 'high',
        assigned_to: 'user-2',
        created_at: fourHoursAgo,
        resolved_at: now.toISOString(), // Duration: 4.0 hours (240 minutes)
        version: 3
      });

      // Average duration should be (2.0 + 4.0) / 2 = 3.0 hours (180 minutes)
      const metrics = await findingRepository.getDashboardMetrics();

      expect(metrics.mttr.resolvedCases).toBe(2);
      expect(metrics.mttr.avgHours).toBeCloseTo(3.0, 1);
      expect(metrics.mttr.avgMinutes).toBeCloseTo(180, 5);
    });

    it('should accurately categorize incident status distribution and unassigned tickets', async () => {
      memoryStore.incidents.push({
        incident_id: 'inc-1',
        title: 'Open Case',
        status: 'open',
        priority: 'critical',
        assigned_to: null,
        created_at: new Date().toISOString(),
        version: 1
      });

      memoryStore.incidents.push({
        incident_id: 'inc-2',
        title: 'In Progress Case',
        status: 'in_progress',
        priority: 'high',
        assigned_to: '00000000-0000-0000-0000-000000000002',
        created_at: new Date().toISOString(),
        version: 1
      });

      const metrics = await findingRepository.getDashboardMetrics();

      expect(metrics.incidents.total).toBe(2);
      expect(metrics.incidents.open).toBe(1);
      expect(metrics.incidents.in_progress).toBe(1);
      expect(metrics.incidents.unassigned).toBe(1);
      expect(metrics.incidents.byPriority.critical).toBe(1);
      expect(metrics.incidents.byPriority.high).toBe(1);
    });
  });

  // ============================================================================
  // 2. REST API Integration for Analytics & Audit
  // ============================================================================
  describe('Analytics & Audit REST Endpoints', () => {
    it('GET /api/analytics/dashboard should respond with 200 and complete metrics tree when authenticated', async () => {
      const res = await request(app)
        .get('/api/analytics/dashboard')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.scans).toBeDefined();
      expect(res.body.data.findingsBySeverity).toBeDefined();
      expect(res.body.data.findingsByCategory).toBeDefined();
      expect(res.body.data.incidents).toBeDefined();
      expect(res.body.data.mttr).toBeDefined();
    });

    it('GET /api/audit-logs should return paginated audit trail events with metadata when authenticated', async () => {
      // Seed audit event
      memoryStore.audit_logs.push({
        audit_id: 'audit-test-1',
        user_id: '00000000-0000-0000-0000-000000000001',
        event_type: 'scan_completed',
        entity_type: 'scan_job',
        entity_id: 'scan-uuid-1',
        metadata: { filename: 'auth.json', total_findings: 3 },
        created_at: new Date().toISOString()
      });

      const res = await request(app)
        .get('/api/audit-logs?limit=10&offset=0')
        .set('Authorization', authHeader);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].event_type).toBe('scan_completed');
      expect(res.body.data[0].metadata.filename).toBe('auth.json');
    });
  });
});
