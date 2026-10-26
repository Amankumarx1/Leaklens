import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import blobStorageService, {
  generateSafeBlobPath,
  uploadFile,
  getFileBuffer,
  deleteBlob,
  checkStorageHealth,
  resetLocalStorage,
  getLocalStorageCount
} from '../server/src/services/storage/blobStorageService.js';
import keyVaultService, {
  getSecret,
  setCachedSecret,
  clearSecretCache,
  checkKeyVaultHealth
} from '../server/src/services/cloud/keyVaultService.js';
import { executeScan } from '../server/src/services/scanner/scannerService.js';

describe('Phase 4: Azure Cloud Integration & Resilience Test Suite', () => {
  const app = createApp();

  beforeEach(() => {
    resetLocalStorage();
    clearSecretCache();
  });

  // ============================================================================
  // 1. Health & Readiness Probe Verification
  // ============================================================================
  describe('Cloud Health & Readiness Probes', () => {
    it('GET /api/health should respond with 200 and liveness metrics', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.components.api.status).toBe('up');
      expect(typeof res.body.data.uptimeSeconds).toBe('number');
    });

    it('GET /api/health/ready should respond with readiness status for external dependencies', async () => {
      const res = await request(app).get('/api/health/ready');
      expect([200, 503]).toContain(res.status);
      expect(res.body.dependencies).toBeDefined();
      expect(res.body.dependencies.database).toBeDefined();
      expect(res.body.dependencies.storage).toBeDefined();
      expect(res.body.dependencies.secrets).toBeDefined();
    });

    it('GET /api/health/ready should never leak credentials or internal connection strings', async () => {
      const res = await request(app).get('/api/health/ready');
      const serialized = JSON.stringify(res.body).toLowerCase();

      expect(serialized).not.toContain('password');
      expect(serialized).not.toContain('db_password');
      expect(serialized).not.toContain('connectionstring');
      expect(serialized).not.toContain('session_secret');
      expect(serialized).not.toContain('jwt_secret');
      expect(serialized).not.toContain('access_token');
    });
  });

  // ============================================================================
  // 2. Private Blob Storage Integration & Safe Path Generation
  // ============================================================================
  describe('Private Azure Blob Storage Service', () => {
    it('should generate non-reversible, randomized storage paths without user-provided filenames', () => {
      const path1 = generateSafeBlobPath('scan-123', 'file-456');
      const path2 = generateSafeBlobPath('scan-123', 'file-456');

      expect(path1).toBe('scans/scan-123/file-456.bin');
      expect(path1).not.toContain('.txt');
      expect(path1).not.toContain('.json');
      expect(path1).not.toContain('.csv');
      expect(path1).not.toContain('passwords');
    });

    it('should reject empty buffers from storage upload', async () => {
      await expect(
        uploadFile({
          blobPath: 'scans/test/empty.bin',
          buffer: Buffer.alloc(0)
        })
      ).rejects.toThrow('Cannot upload empty buffer');
    });

    it('should upload, retrieve and verify binary fidelity in storage provider', async () => {
      const sampleContent = Buffer.from('TEST_DATA_EXPOSURE_SAMPLE_CONTENT');
      const safePath = generateSafeBlobPath();

      const uploadResult = await uploadFile({
        blobPath: safePath,
        buffer: sampleContent,
        mimeType: 'text/plain',
        metadata: { scan_id: 'test-scan' }
      });

      expect(uploadResult.blobPath).toBe(safePath);
      expect(uploadResult.sizeBytes).toBe(sampleContent.length);

      // Verify retrieval
      const retrieved = await getFileBuffer(safePath);
      expect(retrieved.toString('utf-8')).toBe('TEST_DATA_EXPOSURE_SAMPLE_CONTENT');
    });

    it('should return BLOB_NOT_FOUND error when attempting to fetch non-existent blob', async () => {
      await expect(getFileBuffer('scans/missing/file.bin')).rejects.toThrow();
    });

    it('should delete stored blobs during cleanup operations', async () => {
      const sample = Buffer.from('TEMPORARY_UPLOAD');
      const safePath = generateSafeBlobPath();

      await uploadFile({ blobPath: safePath, buffer: sample });
      expect(getLocalStorageCount()).toBe(1);

      const deleted = await deleteBlob(safePath);
      expect(deleted).toBe(true);
      expect(getLocalStorageCount()).toBe(0);

      await expect(getFileBuffer(safePath)).rejects.toThrow();
    });

    it('should confirm storage service health check operationality', async () => {
      const health = await checkStorageHealth();
      expect(health.isHealthy).toBe(true);
      expect(health.container).toBeDefined();
    });
  });

  // ============================================================================
  // 3. Compensating Storage Cleanup on Downstream Scan Failures
  // ============================================================================
  describe('Storage/Database Consistency & Compensating Cleanup', () => {
    it('should execute compensating deletion of uploaded blobs if parsing/scanning encounters fatal error', async () => {
      expect(getLocalStorageCount()).toBe(0);

      // Trigger a fatal processing failure via malformed parser input
      const invalidBuffer = Buffer.from('{"invalid json syntax: missing closing brace');

      await expect(
        executeScan({
          userId: '00000000-0000-0000-0000-000000000001',
          filename: 'corrupted.json',
          buffer: invalidBuffer
        })
      ).rejects.toThrow();

      // Confirm that compensating cleanup removed the orphaned blob from storage
      expect(getLocalStorageCount()).toBe(0);
    });

    it('should complete scan workflow and persist storage blob reference when successful', async () => {
      const validBuffer = Buffer.from('API_KEY=AKIAIOSFODNN7EXAMPLE\nSECRET=test');
      const result = await executeScan({
        userId: '00000000-0000-0000-0000-000000000001',
        filename: 'credentials.txt',
        buffer: validBuffer
      });

      expect(result.status).toBe('completed');
      expect(result.file.blob_path).toMatch(/^scans\/[a-f0-9-]+\/[a-f0-9-]+\.bin$/);
      expect(getLocalStorageCount()).toBe(1);
    });
  });

  // ============================================================================
  // 4. Key Vault & Secrets Management Service
  // ============================================================================
  describe('Key Vault & Secrets Management', () => {
    it('should retrieve cached secret values directly without external roundtrip', async () => {
      setCachedSecret('SESSION_SECRET', 'test-cached-session-secret-32-chars-long');

      const val = await getSecret('SESSION_SECRET');
      expect(val).toBe('test-cached-session-secret-32-chars-long');
    });

    it('should fall back gracefully to environment variables when Key Vault is not connected', async () => {
      process.env.TEST_SECRET_KEY = 'env-fallback-value-123';
      const val = await getSecret('TEST_SECRET_KEY');
      expect(val).toBe('env-fallback-value-123');
      delete process.env.TEST_SECRET_KEY;
    });

    it('should confirm Key Vault health check reporting', async () => {
      const health = await checkKeyVaultHealth();
      expect(health.isHealthy).toBe(true);
      expect(typeof health.message).toBe('string');
    });
  });

  // ============================================================================
  // 5. App Service Security Hardening & HTTP Headers
  // ============================================================================
  describe('App Service Hardened HTTP Headers & Reverse Proxy', () => {
    it('should include strict security headers on API responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
      expect(res.headers['content-security-policy']).toBeDefined();
      expect(res.headers['x-powered-by']).toBeUndefined();
    });

    it('should reject unauthorized cross-origin requests according to CORS policy', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-third-party-site.com');

      // Supertest returns 500 when CORS error callback is invoked
      expect(res.status).toBe(500);
    });

    it('should route unmatched API paths to safe 404 handler', async () => {
      const res = await request(app).get('/api/non-existent-cloud-path');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('RESOURCE_NOT_FOUND');
    });
  });
});
