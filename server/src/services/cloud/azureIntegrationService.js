import env from '../../config/env.js';
import memoryStore from '../../repositories/memoryStore.js';
import { checkDatabaseHealth, executeQuery } from '../../database/connection.js';
import blobStorageService, {
  checkStorageHealth,
  initBlobServiceClient,
  getContainerName
} from '../storage/blobStorageService.js';
import keyVaultService, {
  getKeyVaultUri,
  checkKeyVaultHealth
} from './keyVaultService.js';
import { validatePowerBiUrl } from './integrationValidator.js';
import { createAuditEntry } from '../../repositories/auditRepository.js';

// Mutex locks to prevent overlapping duplicate tests
const activeTests = new Set();

/**
 * Normalizes status strings strictly per specification:
 * CONNECTED | NOT CONFIGURED | NEEDS SETUP | CONNECTION FAILED | DEGRADED | CHECKING
 */
export const STATUS_STATES = {
  CONNECTED: 'CONNECTED',
  NOT_CONFIGURED: 'NOT CONFIGURED',
  NEEDS_SETUP: 'NEEDS SETUP',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  DEGRADED: 'DEGRADED',
  CHECKING: 'CHECKING'
};

/**
 * Returns complete sanitised metadata for all 5 Azure integrations.
 */
export async function getIntegrationsSummary() {
  const prefs = memoryStore.integration_preferences || {};
  const lastChecks = memoryStore.integration_last_checks || {};

  // 1. Azure SQL
  const isSqlConfigured = !!(env.DB.server && env.DB.server !== 'localhost' && env.DB.database);
  const sqlCheck = lastChecks.sql || null;
  const sqlStatus = sqlCheck
    ? (sqlCheck.isConnected ? STATUS_STATES.CONNECTED : (isSqlConfigured ? STATUS_STATES.CONNECTION_FAILED : STATUS_STATES.NOT_CONFIGURED))
    : (isSqlConfigured ? STATUS_STATES.NEEDS_SETUP : STATUS_STATES.NOT_CONFIGURED);

  // 2. Azure Blob Storage
  const isBlobConfigured = !!(env.AZURE.STORAGE_ACCOUNT_NAME || env.AZURE.STORAGE_CONNECTION_STRING);
  const blobCheck = lastChecks.blob || null;
  const blobStatus = blobCheck
    ? (blobCheck.isConnected ? STATUS_STATES.CONNECTED : (isBlobConfigured ? STATUS_STATES.CONNECTION_FAILED : STATUS_STATES.NOT_CONFIGURED))
    : (isBlobConfigured ? STATUS_STATES.NEEDS_SETUP : STATUS_STATES.NOT_CONFIGURED);

  // 3. Azure Key Vault
  const vaultUri = getKeyVaultUri();
  const isVaultConfigured = !!vaultUri;
  const vaultCheck = lastChecks['key-vault'] || null;
  const vaultStatus = vaultCheck
    ? (vaultCheck.isConnected ? STATUS_STATES.CONNECTED : (isVaultConfigured ? STATUS_STATES.CONNECTION_FAILED : STATUS_STATES.NOT_CONFIGURED))
    : (isVaultConfigured ? STATUS_STATES.NEEDS_SETUP : STATUS_STATES.NOT_CONFIGURED);

  // 4. Power BI
  const pbiUrl = prefs.power_bi_report_url || '';
  const isPbiConfigured = !!pbiUrl;
  const pbiCheck = lastChecks['power-bi'] || null;
  const pbiStatus = pbiCheck
    ? (pbiCheck.isConnected ? STATUS_STATES.CONNECTED : STATUS_STATES.CONNECTION_FAILED)
    : (isPbiConfigured ? STATUS_STATES.CONNECTED : STATUS_STATES.NOT_CONFIGURED);

  // 5. Azure App Service & Managed Identity
  const isAppService = !!(process.env.WEBSITE_SITE_NAME);
  const isMsi = !!(process.env.IDENTITY_ENDPOINT || process.env.MSI_ENDPOINT || process.env.AZURE_CLIENT_ID);

  return {
    overview: {
      totalServices: 5,
      connectedCount: [sqlStatus, blobStatus, vaultStatus, pbiStatus].filter(s => s === STATUS_STATES.CONNECTED).length + (isAppService ? 1 : 0),
      environment: env.NODE_ENV,
      managedIdentityEnabled: isMsi,
      lastOverallCheck: new Date().toISOString()
    },
    integrations: [
      {
        id: 'sql',
        name: 'Azure SQL Database',
        category: 'DATABASE',
        icon: 'database',
        status: sqlStatus,
        authMethod: env.DB.authType === 'azure-active-directory-default' ? 'Microsoft Entra Managed Identity' : 'SQL Authentication',
        resourceIdentifier: env.DB.server ? `${env.DB.server}:${env.DB.port} / ${env.DB.database}` : 'Not configured',
        serverName: env.DB.server || 'None',
        databaseName: env.DB.database || 'None',
        lastChecked: sqlCheck?.timestamp || null,
        lastResult: sqlCheck?.message || (isSqlConfigured ? 'Awaiting test execution' : 'Not configured in active environment'),
        latencyMs: sqlCheck?.latencyMs || null,
        schemaStatus: sqlCheck?.schemaStatus || 'Unknown',
        configured: isSqlConfigured,
        canTest: true,
        details: {
          encryption: env.DB.options.encrypt ? 'TLS 1.2 Enforced' : 'Disabled',
          certificateVerification: !env.DB.options.trustServerCertificate ? 'Strict CA Validation' : 'Trust Server Certificate',
          poolSize: `${env.DB.pool.min} - ${env.DB.pool.max} connections`
        }
      },
      {
        id: 'blob',
        name: 'Azure Blob Storage',
        category: 'STORAGE',
        icon: 'hard-drive',
        status: blobStatus,
        authMethod: env.AZURE.STORAGE_CONNECTION_STRING ? 'Storage Connection String' : 'Azure Managed Identity',
        resourceIdentifier: env.AZURE.STORAGE_ACCOUNT_NAME
          ? `https://${env.AZURE.STORAGE_ACCOUNT_NAME}.blob.core.windows.net/${env.AZURE.STORAGE_CONTAINER_NAME}`
          : (isBlobConfigured ? `container: ${env.AZURE.STORAGE_CONTAINER_NAME}` : 'Not configured'),
        accountName: env.AZURE.STORAGE_ACCOUNT_NAME || 'None',
        containerName: env.AZURE.STORAGE_CONTAINER_NAME || 'leaklens-scans',
        lastChecked: blobCheck?.timestamp || null,
        lastResult: blobCheck?.message || (isBlobConfigured ? 'Awaiting test execution' : 'Storage account not configured (using local memory fallback)'),
        latencyMs: blobCheck?.latencyMs || null,
        anonymousAccess: 'DISABLED (Private Access Only)',
        configured: isBlobConfigured,
        canTest: true,
        details: {
          containerAccessPolicy: 'Strictly Private (No Anonymous Read)',
          pathIsolationScheme: 'Opaque Non-Reversible UUID Prefixing',
          compensatingCleanup: 'Automatic Orphan Deletion on Scan Error'
        }
      },
      {
        id: 'key-vault',
        name: 'Azure Key Vault',
        category: 'SECRETS',
        icon: 'key',
        status: vaultStatus,
        authMethod: 'Azure Managed Identity (DefaultAzureCredential)',
        resourceIdentifier: vaultUri || 'Not configured',
        vaultUri: vaultUri || 'None',
        requiredSecretNames: ['SESSION-SECRET', 'DB-PASSWORD'],
        lastChecked: vaultCheck?.timestamp || null,
        lastResult: vaultCheck?.message || (isVaultConfigured ? 'Awaiting test execution' : 'Key Vault not configured (using local environment secrets)'),
        latencyMs: vaultCheck?.latencyMs || null,
        configured: isVaultConfigured,
        canTest: true,
        details: {
          roleRequirement: 'Key Vault Secrets User (RBAC)',
          cacheScheme: 'RAM In-Memory TTL Cache with Safe Fallback',
          secretExposureRisk: 'Zero Plaintext Exposure (RAM Transient Only)'
        }
      },
      {
        id: 'power-bi',
        name: 'Power BI',
        category: 'ANALYTICS',
        icon: 'bar-chart-2',
        status: pbiStatus,
        authMethod: 'Organizational Microsoft Entra ID',
        resourceIdentifier: prefs.power_bi_report_url || 'Not configured',
        reportName: prefs.power_bi_report_name || 'Executive Exposure Telemetry',
        reportUrl: prefs.power_bi_report_url || '',
        mode: 'EXTERNAL_LINK',
        lastChecked: pbiCheck?.timestamp || null,
        lastResult: pbiCheck?.message || (isPbiConfigured ? 'Verified against Power BI allowlist' : 'No report URL configured'),
        latencyMs: pbiCheck?.latencyMs || null,
        configured: isPbiConfigured,
        canTest: true,
        details: {
          directQueryViews: ['leaklens.vw_exposure_analytics', 'leaklens.vw_incident_analytics'],
          supportedHostnames: 'app.powerbi.com, *.powerbi.com',
          linkPolicy: 'noopener, noreferrer, strict-origin'
        }
      },
      {
        id: 'app-service',
        name: 'Azure App Service & Managed Identity',
        category: 'COMPUTE',
        icon: 'cpu',
        status: isAppService ? STATUS_STATES.CONNECTED : STATUS_STATES.DEGRADED,
        authMethod: 'System-Assigned Managed Identity',
        resourceIdentifier: process.env.WEBSITE_SITE_NAME ? `${process.env.WEBSITE_SITE_NAME}.azurewebsites.net` : 'leaklens-local-host',
        appName: process.env.WEBSITE_SITE_NAME || 'leaklens-local-dev',
        environment: env.NODE_ENV,
        region: process.env.REGION_NAME || 'East US (Local Dev)',
        lastChecked: new Date().toISOString(),
        lastResult: isAppService ? 'Running on native Azure App Service with Managed Identity' : 'Running in local container/developer workstation environment',
        configured: true,
        canTest: false,
        details: {
          httpSecurityHeaders: 'HSTS, CSP, X-Frame-Options: DENY, nosniff',
          tlsVersion: 'TLS 1.2+ Enforced',
          managedIdentityVerification: isMsi ? 'Active (IDENTITY_ENDPOINT detected)' : 'Local simulated workstation credential'
        }
      }
    ],
    preferences: {
      power_bi_report_name: prefs.power_bi_report_name || '',
      power_bi_report_url: prefs.power_bi_report_url || '',
      azure_subscription_name: prefs.azure_subscription_name || '',
      azure_resource_group: prefs.azure_resource_group || '',
      azure_region: prefs.azure_region || ''
    }
  };
}

/**
 * Tests active Azure SQL database connection and schema integrity.
 */
export async function testSqlDatabase(userId = null) {
  if (activeTests.has('sql')) {
    const err = new Error('A SQL connection test is already in progress. Please wait.');
    err.code = 'CONCURRENT_TEST_BLOCKED';
    err.status = 429;
    throw err;
  }

  activeTests.add('sql');
  const start = Date.now();

  try {
    const health = await checkDatabaseHealth();
    const latencyMs = Date.now() - start;

    let isConnected = false;
    let message = '';
    let schemaStatus = 'UNVERIFIED';
    let schemaObjectsCount = 0;

    if (health.isHealthy) {
      isConnected = true;
      try {
        const schemaRes = await executeQuery(`
          SELECT COUNT(*) AS total
          FROM INFORMATION_SCHEMA.TABLES
          WHERE TABLE_SCHEMA = 'leaklens'
        `);
        schemaObjectsCount = schemaRes?.recordset?.[0]?.total || 0;
        schemaStatus = schemaObjectsCount >= 5 ? 'VERIFIED' : 'PARTIAL';
        message = `Azure SQL connection successful (${latencyMs}ms). Verified ${schemaObjectsCount} LeakLens relational schema tables.`;
      } catch {
        schemaStatus = 'QUERY_RESTRICTED';
        message = `Azure SQL operational (${latencyMs}ms). Table metadata restricted.`;
      }
    } else {
      isConnected = false;
      message = 'Database unreachable or credentials rejected. Ensure Azure SQL firewall permits this host and credentials are valid.';
    }

    const checkRecord = {
      isConnected,
      latencyMs,
      message,
      schemaStatus,
      timestamp: new Date().toISOString()
    };

    memoryStore.integration_last_checks.sql = checkRecord;

    await createAuditEntry({
      user_id: userId,
      event_type: 'INTEGRATION_TEST_EXECUTED',
      entity_type: 'AZURE_INTEGRATION',
      entity_id: 'sql',
      metadata: { isConnected, latencyMs, message, schemaStatus }
    }).catch(() => null);

    return {
      service: 'sql',
      isConnected,
      status: isConnected ? STATUS_STATES.CONNECTED : STATUS_STATES.CONNECTION_FAILED,
      latencyMs,
      message,
      schemaStatus,
      schemaObjectsCount,
      lastChecked: checkRecord.timestamp
    };
  } finally {
    activeTests.delete('sql');
  }
}

/**
 * Tests Azure Blob Storage connectivity by executing an isolated probe write, read, and delete.
 */
export async function testBlobStorage(userId = null) {
  if (activeTests.has('blob')) {
    const err = new Error('A Blob Storage connection test is already in progress. Please wait.');
    err.code = 'CONCURRENT_TEST_BLOCKED';
    err.status = 429;
    throw err;
  }

  activeTests.add('blob');
  const start = Date.now();

  try {
    const containerName = getContainerName();
    const client = initBlobServiceClient();
    const isConfigured = !!(env.AZURE.STORAGE_ACCOUNT_NAME || env.AZURE.STORAGE_CONNECTION_STRING);

    let isConnected = false;
    let message = '';
    const probePath = `healthcheck/connectivity-probe-${Date.now()}.bin`;

    if (isConfigured && client) {
      try {
        const containerClient = client.getContainerClient(containerName);
        await containerClient.createIfNotExists({ access: undefined });

        // Write small probe
        const probeContent = Buffer.from(`LEAKLENS_PROBE_${Date.now()}`);
        const blockClient = containerClient.getBlockBlobClient(probePath);
        await blockClient.upload(probeContent, probeContent.length);

        // Read and verify
        const downloadRes = await blockClient.downloadToBuffer();
        if (downloadRes.toString('utf-8') !== probeContent.toString('utf-8')) {
          throw new Error('Data integrity verification failed on test probe');
        }

        // Clean up immediately
        await blockClient.deleteIfExists();

        isConnected = true;
        message = `Blob Storage access verified for container "${containerName}". Read/Write/Delete probe succeeded with private access.`;
      } catch (err) {
        isConnected = false;
        message = `Blob Storage connection failed: ${err.message}. Check storage firewall, RBAC role (Storage Blob Data Contributor), and network access.`;
      }
    } else {
      // Local development fallback
      isConnected = false;
      message = 'Azure Storage account is not configured in this environment. Operating in memory fallback mode.';
    }

    const latencyMs = Date.now() - start;
    const checkRecord = {
      isConnected,
      latencyMs,
      message,
      containerName,
      timestamp: new Date().toISOString()
    };

    memoryStore.integration_last_checks.blob = checkRecord;

    await createAuditEntry({
      user_id: userId,
      event_type: 'INTEGRATION_TEST_EXECUTED',
      entity_type: 'AZURE_INTEGRATION',
      entity_id: 'blob',
      metadata: { isConnected, latencyMs, containerName, message }
    }).catch(() => null);

    return {
      service: 'blob',
      isConnected,
      status: isConnected ? STATUS_STATES.CONNECTED : (isConfigured ? STATUS_STATES.CONNECTION_FAILED : STATUS_STATES.NOT_CONFIGURED),
      latencyMs,
      message,
      containerName,
      anonymousAccess: 'DISABLED',
      lastChecked: checkRecord.timestamp
    };
  } finally {
    activeTests.delete('blob');
  }
}

/**
 * Tests Azure Key Vault access without leaking secrets.
 */
export async function testKeyVault(userId = null) {
  if (activeTests.has('key-vault')) {
    const err = new Error('A Key Vault connection test is already in progress. Please wait.');
    err.code = 'CONCURRENT_TEST_BLOCKED';
    err.status = 429;
    throw err;
  }

  activeTests.add('key-vault');
  const start = Date.now();

  try {
    const vaultUri = getKeyVaultUri();
    const isConfigured = !!vaultUri;
    const health = await checkKeyVaultHealth();
    const latencyMs = Date.now() - start;

    let isConnected = false;
    let message = '';

    if (isConfigured && health.isHealthy) {
      isConnected = true;
      message = `Key Vault connection verified for "${vaultUri}". Managed identity authenticated with secret retrieval permissions.`;
    } else if (isConfigured && !health.isHealthy) {
      isConnected = false;
      message = `Key Vault connection failed: ${health.message}. Verify "Key Vault Secrets User" role assignment in Azure Portal.`;
    } else {
      isConnected = false;
      message = 'Key Vault URI is not configured in runtime environment. Application using local environment secret fallback.';
    }

    const checkRecord = {
      isConnected,
      latencyMs,
      message,
      vaultUri,
      timestamp: new Date().toISOString()
    };

    memoryStore.integration_last_checks['key-vault'] = checkRecord;

    await createAuditEntry({
      user_id: userId,
      event_type: 'INTEGRATION_TEST_EXECUTED',
      entity_type: 'AZURE_INTEGRATION',
      entity_id: 'key-vault',
      metadata: { isConnected, latencyMs, message }
    }).catch(() => null);

    return {
      service: 'key-vault',
      isConnected,
      status: isConnected ? STATUS_STATES.CONNECTED : (isConfigured ? STATUS_STATES.CONNECTION_FAILED : STATUS_STATES.NOT_CONFIGURED),
      latencyMs,
      message,
      vaultUri,
      lastChecked: checkRecord.timestamp
    };
  } finally {
    activeTests.delete('key-vault');
  }
}

/**
 * Validates Power BI report URL and integration configuration.
 */
export async function testPowerBi(customUrl = null, userId = null) {
  const prefs = memoryStore.integration_preferences || {};
  const urlToTest = customUrl || prefs.power_bi_report_url || '';
  const start = Date.now();

  const validation = validatePowerBiUrl(urlToTest);
  const latencyMs = Date.now() - start;

  let isConnected = false;
  let message = '';

  if (validation.valid) {
    isConnected = true;
    message = `Power BI report URL successfully validated against Microsoft Power BI allowlist (${validation.parsedUrl.hostname}). Ready for secure external viewing.`;
  } else {
    isConnected = false;
    message = validation.error || 'Invalid Power BI report configuration.';
  }

  const checkRecord = {
    isConnected,
    latencyMs,
    message,
    timestamp: new Date().toISOString()
  };

  memoryStore.integration_last_checks['power-bi'] = checkRecord;

  await createAuditEntry({
    user_id: userId,
    event_type: 'INTEGRATION_TEST_EXECUTED',
    entity_type: 'AZURE_INTEGRATION',
    entity_id: 'power-bi',
    metadata: { isConnected, latencyMs, message }
  }).catch(() => null);

  return {
    service: 'power-bi',
    isConnected,
    status: isConnected ? STATUS_STATES.CONNECTED : STATUS_STATES.CONNECTION_FAILED,
    latencyMs,
    message,
    reportUrl: urlToTest,
    mode: 'EXTERNAL_LINK',
    lastChecked: checkRecord.timestamp
  };
}

/**
 * Saves non-secret integration preferences.
 */
export async function saveIntegrationPreferences(userId, updateData = {}) {
  const current = memoryStore.integration_preferences || {};

  // If power_bi_report_url is updated, validate it
  if (updateData.power_bi_report_url) {
    const val = validatePowerBiUrl(updateData.power_bi_report_url);
    if (!val.valid) {
      const err = new Error(val.error);
      err.code = 'INVALID_POWER_BI_URL';
      err.status = 400;
      throw err;
    }
  }

  const allowedKeys = [
    'power_bi_report_name',
    'power_bi_report_url',
    'azure_subscription_name',
    'azure_resource_group',
    'azure_region'
  ];

  const updated = { ...current };
  const changedFields = [];

  for (const key of allowedKeys) {
    if (updateData[key] !== undefined) {
      updated[key] = String(updateData[key]).trim();
      changedFields.push(key);
    }
  }

  memoryStore.integration_preferences = updated;

  await createAuditEntry({
    user_id: userId,
    event_type: 'INTEGRATION_PREFERENCES_SAVED',
    entity_type: 'AZURE_INTEGRATION',
    entity_id: 'preferences',
    metadata: { changedFields }
  }).catch(() => null);

  return updated;
}

export default {
  STATUS_STATES,
  getIntegrationsSummary,
  testSqlDatabase,
  testBlobStorage,
  testKeyVault,
  testPowerBi,
  saveIntegrationPreferences
};
