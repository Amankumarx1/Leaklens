import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/src/app.js';
import env from '../server/src/config/env.js';
import memoryStore from '../server/src/repositories/memoryStore.js';
import {
  validatePowerBiUrl,
  validateSqlHostname,
  validateStorageAccountName,
  validateKeyVaultInput
} from '../server/src/services/cloud/integrationValidator.js';

describe('Azure Integrations Settings & Connection Wizard Test Suite', () => {
  const app = createApp();

  // Helper to create tokens with specific roles
  const makeToken = (role = 'ADMIN', userId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001') => {
    return jwt.sign(
      {
        user_id: userId,
        email: `${role.toLowerCase()}@leaklens.local`,
        role
      },
      env.SESSION_SECRET,
      { expiresIn: '1h' }
    );
  };

  const adminToken = makeToken('ADMIN');
  const analystToken = makeToken('ANALYST');
  const complianceToken = makeToken('COMPLIANCE_REVIEWER');

  beforeEach(() => {
    memoryStore.integration_preferences = {
      power_bi_report_name: 'Executive Exposure Telemetry',
      power_bi_report_url: 'https://app.powerbi.com/groups/me/reports/leaklens-executive-summary',
      azure_subscription_name: 'LeakLens-Production-Subscription',
      azure_resource_group: 'rg-leaklens-eastus-001',
      azure_region: 'eastus'
    };
    memoryStore.integration_last_checks = {};
  });

  // ============================================================================
  // 1. RBAC & Administrative Access Controls
  // ============================================================================
  describe('RBAC & Route Protection', () => {
    it('GET /api/admin/integrations must reject unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/admin/integrations');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHORIZED');
    });

    it('GET /api/admin/integrations must reject ANALYST role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/integrations')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('GET /api/admin/integrations must reject COMPLIANCE_REVIEWER role with 403 Forbidden', async () => {
      const res = await request(app)
        .get('/api/admin/integrations')
        .set('Authorization', `Bearer ${complianceToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
    });

    it('GET /api/admin/integrations must permit ADMIN role with 200 and sanitised overview', async () => {
      const res = await request(app)
        .get('/api/admin/integrations')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.overview).toBeDefined();
      expect(res.body.data.overview.totalServices).toBe(5);
      expect(Array.isArray(res.body.data.integrations)).toBe(true);
      expect(res.body.data.integrations.length).toBe(5);
    });
  });

  // ============================================================================
  // 2. Secret Redaction & Sanitization
  // ============================================================================
  describe('Zero Plaintext Secret Exposure', () => {
    it('metadata payload must never leak passwords, client secrets, or full connection strings', async () => {
      const res = await request(app)
        .get('/api/admin/integrations')
        .set('Authorization', `Bearer ${adminToken}`);

      const bodyStr = JSON.stringify(res.body).toLowerCase();
      expect(bodyStr).not.toContain('leaklensdev2026');
      expect(bodyStr).not.toContain('db_password');
      expect(bodyStr).not.toContain('accountkey=');
      expect(bodyStr).not.toContain('sharedaccesssignature');
      expect(bodyStr).not.toContain('session_secret');
    });
  });

  // ============================================================================
  // 3. Azure SQL Database Connection Test
  // ============================================================================
  describe('Azure SQL Database Connection Test (POST /api/admin/integrations/sql/test)', () => {
    it('should test SQL connectivity and report sanitised status and schema validation', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/sql/test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.service).toBe('sql');
      expect(typeof res.body.data.isConnected).toBe('boolean');
      expect(res.body.data.status).toBeDefined();
      expect(typeof res.body.data.latencyMs).toBe('number');
      expect(res.body.data.message).toBeDefined();
    });

    it('should deny non-admin operators from executing SQL connection test', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/sql/test')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ============================================================================
  // 4. Azure Blob Storage Connection Test
  // ============================================================================
  describe('Azure Blob Storage Connection Test (POST /api/admin/integrations/blob/test)', () => {
    it('should execute storage test probe and verify anonymous access is disabled', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/blob/test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.service).toBe('blob');
      expect(typeof res.body.data.isConnected).toBe('boolean');
      expect(res.body.data.anonymousAccess).toBe('DISABLED');
      expect(res.body.data.containerName).toBe('leaklens-scans');
      expect(typeof res.body.data.latencyMs).toBe('number');
    });
  });

  // ============================================================================
  // 5. Azure Key Vault Connection Test
  // ============================================================================
  describe('Azure Key Vault Connection Test (POST /api/admin/integrations/key-vault/test)', () => {
    it('should verify Key Vault accessibility without returning secret values', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/key-vault/test')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.service).toBe('key-vault');
      expect(typeof res.body.data.isConnected).toBe('boolean');
      expect(res.body.data.message).toBeDefined();

      // Ensure no secret contents are present in test payload
      expect(res.body.data.secretValue).toBeUndefined();
      expect(res.body.data.secrets).toBeUndefined();
    });
  });

  // ============================================================================
  // 6. Power BI Report Link Validation & SSRF Defense
  // ============================================================================
  describe('Power BI Validation & SSRF Defense (POST /api/admin/integrations/power-bi/test)', () => {
    it('should accept valid official Power BI report URLs', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/power-bi/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reportUrl: 'https://app.powerbi.com/groups/00000000-0000-0000-0000-000000000000/reports/11111111-1111-1111-1111-111111111111' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isConnected).toBe(true);
      expect(res.body.data.status).toBe('CONNECTED');
    });

    it('should reject insecure HTTP protocol', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/power-bi/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reportUrl: 'http://app.powerbi.com/report' });

      expect(res.status).toBe(200);
      expect(res.body.data.isConnected).toBe(false);
      expect(res.body.data.status).toBe('CONNECTION_FAILED');
      expect(res.body.data.message).toContain('HTTPS');
    });

    it('should reject non-Power BI arbitrary domains (SSRF prevention)', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/power-bi/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reportUrl: 'https://malicious-external-site.com/report' });

      expect(res.status).toBe(200);
      expect(res.body.data.isConnected).toBe(false);
      expect(res.body.data.status).toBe('CONNECTION_FAILED');
      expect(res.body.data.message).toContain('Only official Power BI domains');
    });

    it('should reject localhost and private IP addresses (SSRF loopback defense)', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/power-bi/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reportUrl: 'https://127.0.0.1/meta-data' });

      expect(res.status).toBe(200);
      expect(res.body.data.isConnected).toBe(false);
      expect(res.body.data.message).toContain('SSRF Protection');
    });

    it('should reject Azure IMDS link-local IP (169.254.169.254)', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/power-bi/test')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reportUrl: 'https://169.254.169.254/metadata/identity/oauth2/token' });

      expect(res.status).toBe(200);
      expect(res.body.data.isConnected).toBe(false);
      expect(res.body.data.message).toContain('SSRF Protection');
    });
  });

  // ============================================================================
  // 7. Preferences Persistence (PUT /api/admin/integrations/preferences)
  // ============================================================================
  describe('Preferences Persistence', () => {
    it('should save valid non-secret integration preferences and record audit log', async () => {
      const res = await request(app)
        .put('/api/admin/integrations/preferences')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          power_bi_report_name: 'Q3 Enterprise Risk Telemetry',
          power_bi_report_url: 'https://app.powerbi.com/groups/me/reports/q3-risk',
          azure_subscription_name: 'Corporate-Security-Sub',
          azure_resource_group: 'rg-corp-sec',
          azure_region: 'westeurope'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.power_bi_report_name).toBe('Q3 Enterprise Risk Telemetry');
      expect(res.body.data.azure_region).toBe('westeurope');

      // Verify persistence in memoryStore
      expect(memoryStore.integration_preferences.power_bi_report_name).toBe('Q3 Enterprise Risk Telemetry');

      // Verify audit log entry
      const auditLog = memoryStore.audit_logs.find(l => l.event_type === 'INTEGRATION_PREFERENCES_SAVED');
      expect(auditLog).toBeDefined();
      expect(auditLog.entity_type).toBe('AZURE_INTEGRATION');
    });

    it('should reject invalid Power BI report URL on preference update', async () => {
      const res = await request(app)
        .put('/api/admin/integrations/preferences')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          power_bi_report_url: 'https://unauthorized-domain.com/report'
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_POWER_BI_URL');
    });
  });

  // ============================================================================
  // 8. Unit Validation Functions
  // ============================================================================
  describe('Integration Validator Unit Functions', () => {
    it('validatePowerBiUrl should enforce HTTPS and domain allowlist', () => {
      expect(validatePowerBiUrl('https://app.powerbi.com/view').valid).toBe(true);
      expect(validatePowerBiUrl('https://tenant.powerbi.com/report').valid).toBe(true);
      expect(validatePowerBiUrl('http://app.powerbi.com/view').valid).toBe(false);
      expect(validatePowerBiUrl('https://google.com').valid).toBe(false);
      expect(validatePowerBiUrl('https://192.168.1.1').valid).toBe(false);
    });

    it('validateSqlHostname should enforce .database.windows.net syntax', () => {
      expect(validateSqlHostname('myserver.database.windows.net').valid).toBe(true);
      expect(validateSqlHostname('myserver.database.azure.com').valid).toBe(true);
      expect(validateSqlHostname('localhost', false).valid).toBe(true);
      expect(validateSqlHostname('localhost', true).valid).toBe(false);
      expect(validateSqlHostname('invalidsqlserver.com').valid).toBe(false);
    });

    it('validateStorageAccountName should enforce Azure storage naming constraints', () => {
      expect(validateStorageAccountName('validaccount123').valid).toBe(true);
      expect(validateStorageAccountName('ab').valid).toBe(false); // too short
      expect(validateStorageAccountName('AccountWithCaps').valid).toBe(false); // uppercase forbidden
      expect(validateStorageAccountName('account-with-dash').valid).toBe(false); // dashes forbidden
      expect(validateStorageAccountName('thisaccountnameiswaytoolongtobevalidinazure').valid).toBe(false); // > 24
    });

    it('validateKeyVaultInput should validate vault names and URIs', () => {
      expect(validateKeyVaultInput('kv-myvault-01').valid).toBe(true);
      expect(validateKeyVaultInput('https://kv-myvault-01.vault.azure.net').valid).toBe(true);
      expect(validateKeyVaultInput('https://invalidvault.com').valid).toBe(false);
    });
  });

  // ============================================================================
  // 9. In-Platform Cloud Provisioning & Direct Execution
  // ============================================================================
  describe('In-Platform Cloud Provisioning & Execution Actions', () => {
    it('POST /api/admin/integrations/sql/authorize should execute T-SQL external provider script and grant roles', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/sql/authorize')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ appServiceName: 'leaklens-custom-app' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.script).toContain('CREATE USER [leaklens-custom-app] FROM EXTERNAL PROVIDER;');
      expect(res.body.data.script).toContain('ALTER ROLE db_datareader ADD MEMBER [leaklens-custom-app];');
      expect(res.body.data.script).toContain('ALTER ROLE db_datawriter ADD MEMBER [leaklens-custom-app];');
      expect(res.body.data.script).toContain('GRANT EXECUTE ON SCHEMA::leaklens TO [leaklens-custom-app];');
    });

    it('POST /api/admin/integrations/blob/assign-role should assign Storage Blob Data Contributor', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/blob/assign-role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ appServiceName: 'leaklens-soc-prod', storageAccountName: 'leaklensscansprod' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('Storage Blob Data Contributor');
      expect(res.body.data.accountName).toBe('leaklensscansprod');
    });

    it('POST /api/admin/integrations/key-vault/assign-role should assign Key Vault Secrets User', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/key-vault/assign-role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ appServiceName: 'leaklens-soc-prod', keyVaultUri: 'https://kv-leaklens-prod.vault.azure.net' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.role).toBe('Key Vault Secrets User');
    });

    it('POST /api/admin/integrations/app-service/restart should apply environment variables and reload runtime', async () => {
      const res = await request(app)
        .post('/api/admin/integrations/app-service/restart')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          appServiceName: 'leaklens-soc-prod',
          sqlServer: 'leaklens-sql-server.database.windows.net',
          sqlDatabase: 'LeakLensDB',
          sqlAuthType: 'azure-active-directory-default',
          storageAccountName: 'leaklensscansprod',
          keyVaultUri: 'https://kv-leaklens-prod.vault.azure.net'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.appliedVariables.DB_SERVER).toBe('leaklens-sql-server.database.windows.net');
      expect(res.body.data.appliedVariables.DB_NAME).toBe('LeakLensDB');
      expect(res.body.data.appliedVariables.AZURE_STORAGE_ACCOUNT_NAME).toBe('leaklensscansprod');
      expect(res.body.data.appliedVariables.KEY_VAULT_URI).toBe('https://kv-leaklens-prod.vault.azure.net');
    });
  });
});
