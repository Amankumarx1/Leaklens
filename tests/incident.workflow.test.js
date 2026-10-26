import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/src/app.js';
import env from '../server/src/config/env.js';
import memoryStore from '../server/src/repositories/memoryStore.js';

describe('Incident Response, Remediation & Verification Subsystem', () => {
  const app = createApp();

  const analystToken = jwt.sign(
    { user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002', email: 'analyst@leaklens.local', role: 'ANALYST' },
    env.SESSION_SECRET,
    { expiresIn: '1h' }
  );

  const adminToken = jwt.sign(
    { user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001', email: 'admin@leaklens.local', role: 'ADMIN' },
    env.SESSION_SECRET,
    { expiresIn: '1h' }
  );

  const complianceToken = jwt.sign(
    { user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003', email: 'compliance@leaklens.local', role: 'COMPLIANCE_REVIEWER' },
    env.SESSION_SECRET,
    { expiresIn: '1h' }
  );

  let testFindingId1;
  let testFindingId2;

  beforeEach(() => {
    // Reset/seed memory store findings for tests
    testFindingId1 = 'ffffffff-0000-0000-0000-000000000001';
    testFindingId2 = 'ffffffff-0000-0000-0000-000000000002';

    // Ensure test files and findings exist
    memoryStore.files = [
      {
        file_id: 'file-0001',
        scan_id: 'scan-0001',
        original_filename: 'server_config.json',
        content_hash: 'a'.repeat(64),
        file_size_bytes: 1024,
        mime_type: 'application/json',
        created_at: new Date().toISOString()
      }
    ];

    memoryStore.findings = [
      {
        finding_id: testFindingId1,
        file_id: 'file-0001',
        rule_id: '00000000-0000-0000-0000-000000000002',
        location_reference: '$.api_key',
        masked_excerpt: 'ghp_***_890',
        severity: 'high',
        status: 'detected',
        detected_at: new Date().toISOString(),
        rule_name: 'API_KEY_CANDIDATE_RULE',
        category: 'API_KEY_CANDIDATE'
      },
      {
        finding_id: testFindingId2,
        file_id: 'file-0001',
        rule_id: '00000000-0000-0000-0000-000000000001',
        location_reference: '$.admin_email',
        masked_excerpt: 's***m@corp.test',
        severity: 'low',
        status: 'detected',
        detected_at: new Date().toISOString(),
        rule_name: 'EMAIL_ADDRESS_RULE',
        category: 'EMAIL_ADDRESS'
      }
    ];

    memoryStore.incidents = [];
    memoryStore.incident_findings = [];
    memoryStore.remediation_actions = [];
    memoryStore.audit_logs = [];
  });

  // ---------------------------------------------------------------------------
  // 1. Incident Creation & Validation
  // ---------------------------------------------------------------------------
  it('should create an incident from valid findings and transition findings to confirmed', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Active GitHub Token Exposure in Configuration',
        description: 'Exposed GitHub personal access token discovered in server_config.json',
        priority: 'HIGH',
        findingIds: [testFindingId1, testFindingId2]
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.incident.title).toBe('Active GitHub Token Exposure in Configuration');
    expect(res.body.data.incident.status).toBe('OPEN');
    expect(res.body.data.incident.priority).toBe('HIGH');
    expect(res.body.data.incident.findings.length).toBe(2);

    // Finding status updated to confirmed
    const finding1 = memoryStore.findings.find(f => f.finding_id === testFindingId1);
    expect(finding1.status).toBe('confirmed');

    // Audit log recorded
    const auditCreated = memoryStore.audit_logs.find(a => a.event_type === 'INCIDENT_CREATED');
    expect(auditCreated).toBeDefined();
  });

  it('should reject incident creation with missing title or description', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: '',
        description: '',
        priority: 'HIGH',
        findingIds: [testFindingId1]
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('title is required');
  });

  it('should reject incident creation with empty findingIds array', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Empty Findings Incident',
        description: 'Should fail validation',
        priority: 'MEDIUM',
        findingIds: []
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('At least one finding must be associated');
  });

  it('should reject incident creation with non-existent finding IDs', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Invalid Finding ID Incident',
        description: 'Testing non-existent finding rejection',
        priority: 'MEDIUM',
        findingIds: ['non-existent-uuid-9999']
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Finding not found');
  });

  // ---------------------------------------------------------------------------
  // 2. Incident Assignment
  // ---------------------------------------------------------------------------
  it('should assign and reassign an incident to eligible active users', async () => {
    // 1. Create incident
    const createRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Unassigned API Key Leak',
        description: 'Awaiting triage assignment',
        priority: 'CRITICAL',
        findingIds: [testFindingId1]
      });

    const incidentId = createRes.body.data.incident.incident_id;

    // 2. Assign to Lead Analyst
    const assignRes = await request(app)
      .patch(`/api/incidents/${incidentId}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assignedTo: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002'
      });

    expect(assignRes.status).toBe(200);
    expect(assignRes.body.success).toBe(true);
    expect(assignRes.body.data.incident.assigned_to).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002');
    expect(assignRes.body.data.incident.assigned_user_name).toBe('Lead Security Analyst');

    // Audit log & remediation action recorded
    const assignAction = memoryStore.remediation_actions.find(ra => ra.action_type === 'ASSIGNMENT');
    expect(assignAction).toBeDefined();
  });

  it('should reject assignment to an ineligible role (e.g. COMPLIANCE_REVIEWER)', async () => {
    const createRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Assignment Test Incident',
        description: 'Verifying role eligibility',
        priority: 'LOW',
        findingIds: [testFindingId2]
      });

    const incidentId = createRes.body.data.incident.incident_id;

    // Try assigning to compliance auditor
    const assignRes = await request(app)
      .patch(`/api/incidents/${incidentId}/assignment`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        assignedTo: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003'
      });

    expect(assignRes.status).toBe(400);
    expect(assignRes.body.success).toBe(false);
    expect(assignRes.body.error.message).toContain('not eligible for incident assignment');
  });

  // ---------------------------------------------------------------------------
  // 3. Status Transitions & Lifecycle FSM
  // ---------------------------------------------------------------------------
  it('should enforce allowed status transitions and reject invalid transitions', async () => {
    const createRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Lifecycle Verification Ticket',
        description: 'Tracking status transitions',
        priority: 'HIGH',
        findingIds: [testFindingId1]
      });

    const incidentId = createRes.body.data.incident.incident_id;

    // Transition: OPEN -> IN_PROGRESS (Allowed)
    const progRes = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ status: 'IN_PROGRESS', reason: 'Analyst beginning key audit' });

    expect(progRes.status).toBe(200);
    expect(progRes.body.data.incident.status).toBe('IN_PROGRESS');

    // Transition: IN_PROGRESS -> PENDING_VERIFICATION (Allowed)
    const verifRes = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ status: 'PENDING_VERIFICATION', reason: 'Key rotated in AWS IAM' });

    expect(verifRes.status).toBe(200);
    expect(verifRes.body.data.incident.status).toBe('PENDING_VERIFICATION');

    // Forbidden Transition: PENDING_VERIFICATION -> CLOSED directly (Must be rejected)
    const invalidRes = await request(app)
      .patch(`/api/incidents/${incidentId}/status`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({ status: 'CLOSED', reason: 'Attempting invalid jump' });

    expect(invalidRes.status).toBe(409);
    expect(invalidRes.body.success).toBe(false);
    expect(invalidRes.body.error.message).toContain('not permitted by lifecycle rules');
  });

  // ---------------------------------------------------------------------------
  // 4. Remediation Actions & Verification Workflow
  // ---------------------------------------------------------------------------
  it('should record investigation notes and handle verification failure reverting status', async () => {
    const createRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Remediation Note & Verification Test',
        description: 'Testing verification outcomes',
        priority: 'HIGH',
        findingIds: [testFindingId1]
      });

    const incidentId = createRes.body.data.incident.incident_id;

    // Transition to IN_PROGRESS then PENDING_VERIFICATION
    await request(app).patch(`/api/incidents/${incidentId}/status`).set('Authorization', `Bearer ${analystToken}`).send({ status: 'IN_PROGRESS' });
    await request(app).patch(`/api/incidents/${incidentId}/status`).set('Authorization', `Bearer ${analystToken}`).send({ status: 'PENDING_VERIFICATION' });

    // Add remediation action note
    const actionRes = await request(app)
      .post(`/api/incidents/${incidentId}/actions`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        actionType: 'REMEDIATION',
        notes: 'Revoked access key AKIA... in Cloudflare console.'
      });

    expect(actionRes.status).toBe(201);
    expect(actionRes.body.success).toBe(true);
    expect(actionRes.body.data.action.action_type).toBe('REMEDIATION');

    // Execute Verification with FAILED outcome
    const failVerifRes = await request(app)
      .post(`/api/incidents/${incidentId}/verify`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        outcome: 'FAILED',
        summary: 'Secret token is still active when tested against API endpoint.'
      });

    expect(failVerifRes.status).toBe(200);
    // Incident status should automatically revert to IN_PROGRESS
    expect(failVerifRes.body.data.incident.status).toBe('IN_PROGRESS');
  });

  // ---------------------------------------------------------------------------
  // 5. Transactional Incident Resolution & Concurrency Conflict
  // ---------------------------------------------------------------------------
  it('should execute atomic incident resolution, transition findings to remediated, and record audit trail', async () => {
    const createRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Incident Ready for Atomic Resolution',
        description: 'Resolution workflow verification',
        priority: 'CRITICAL',
        findingIds: [testFindingId1]
      });

    const incidentId = createRes.body.data.incident.incident_id;

    // Move to IN_PROGRESS
    await request(app).patch(`/api/incidents/${incidentId}/status`).set('Authorization', `Bearer ${analystToken}`).send({ status: 'IN_PROGRESS' });

    // Execute transactional resolution
    const resolveRes = await request(app)
      .post(`/api/incidents/${incidentId}/resolve`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        resolutionSummary: 'Token rotated in cloud provider, git repository re-written, and access logs inspected.',
        verificationOutcome: 'PASSED'
      });

    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.success).toBe(true);
    expect(resolveRes.body.data.incident.status).toBe('RESOLVED');
    expect(resolveRes.body.data.incident.resolved_at).toBeDefined();
    expect(resolveRes.body.data.incident.resolution_summary).toContain('Token rotated in cloud provider');

    // Associated findings transitioned to 'remediated'
    const finding = memoryStore.findings.find(f => f.finding_id === testFindingId1);
    expect(finding.status).toBe('remediated');

    // Audit log recorded
    const resolveAudit = memoryStore.audit_logs.find(a => a.event_type === 'INCIDENT_RESOLVED');
    expect(resolveAudit).toBeDefined();
  });

  it('should reject resolution with concurrency conflict when expectedVersion does not match', async () => {
    const createRes = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        title: 'Concurrency Conflict Test Incident',
        description: 'Verifying rowversion/optimistic locking',
        priority: 'HIGH',
        findingIds: [testFindingId1]
      });

    const incidentId = createRes.body.data.incident.incident_id;

    // Move to IN_PROGRESS (increments version)
    await request(app).patch(`/api/incidents/${incidentId}/status`).set('Authorization', `Bearer ${analystToken}`).send({ status: 'IN_PROGRESS' });

    // Attempt resolution with stale version 1 (actual is 2)
    const conflictRes = await request(app)
      .post(`/api/incidents/${incidentId}/resolve`)
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        resolutionSummary: 'Attempting resolution with outdated version',
        expectedVersion: 1
      });

    expect(conflictRes.status).toBe(409);
    expect(conflictRes.body.success).toBe(false);
    expect(conflictRes.body.error.message).toContain('Concurrency conflict');
  });

  // ---------------------------------------------------------------------------
  // 6. Role-Based Permissions (RBAC)
  // ---------------------------------------------------------------------------
  it('should enforce that COMPLIANCE_REVIEWER cannot mutate incidents (HTTP 403)', async () => {
    const res = await request(app)
      .post('/api/incidents')
      .set('Authorization', `Bearer ${complianceToken}`)
      .send({
        title: 'Compliance Creation Attempt',
        description: 'Should be blocked with 403',
        priority: 'LOW',
        findingIds: [testFindingId1]
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('should permit COMPLIANCE_REVIEWER to view incidents in read-only mode', async () => {
    const res = await request(app)
      .get('/api/incidents')
      .set('Authorization', `Bearer ${complianceToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data.incidents)).toBe(true);
  });
});
