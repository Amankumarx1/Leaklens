import azureIntegrationService from '../services/cloud/azureIntegrationService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Controller: Handles Azure Integrations management, connection tests, and preference updates.
 */

export async function getIntegrations(req, res) {
  try {
    const data = await azureIntegrationService.getIntegrationsSummary();
    return successResponse(res, data, null, 200);
  } catch (err) {
    return errorResponse(res, `Failed to fetch integration metadata: ${err.message}`, 'INTEGRATION_METADATA_ERROR', 500);
  }
}

export async function getStatus(req, res) {
  try {
    const data = await azureIntegrationService.getIntegrationsSummary();
    return successResponse(res, {
      overview: data.overview,
      statuses: data.integrations.map(item => ({
        id: item.id,
        name: item.name,
        status: item.status,
        lastChecked: item.lastChecked,
        lastResult: item.lastResult,
        latencyMs: item.latencyMs
      }))
    }, null, 200);
  } catch (err) {
    return errorResponse(res, `Failed to retrieve integration statuses: ${err.message}`, 'INTEGRATION_STATUS_ERROR', 500);
  }
}

export async function updatePreferences(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const updated = await azureIntegrationService.saveIntegrationPreferences(userId, req.body);
    return successResponse(res, updated, 'Integration preferences saved successfully.', 200);
  } catch (err) {
    const status = err.status || 400;
    return errorResponse(res, err.message, err.code || 'INTEGRATION_PREFERENCES_ERROR', status);
  }
}

export async function testSql(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const result = await azureIntegrationService.testSqlDatabase(userId);
    return successResponse(res, result, 'Azure SQL connectivity check completed.', 200);
  } catch (err) {
    const status = err.status || 500;
    return errorResponse(res, err.message, err.code || 'SQL_TEST_ERROR', status);
  }
}

export async function testBlob(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const result = await azureIntegrationService.testBlobStorage(userId);
    return successResponse(res, result, 'Azure Blob Storage connectivity check completed.', 200);
  } catch (err) {
    const status = err.status || 500;
    return errorResponse(res, err.message, err.code || 'BLOB_TEST_ERROR', status);
  }
}

export async function testKeyVault(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const result = await azureIntegrationService.testKeyVault(userId);
    return successResponse(res, result, 'Azure Key Vault connectivity check completed.', 200);
  } catch (err) {
    const status = err.status || 500;
    return errorResponse(res, err.message, err.code || 'KEY_VAULT_TEST_ERROR', status);
  }
}

export async function testPowerBi(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const customUrl = req.body?.reportUrl || null;
    const result = await azureIntegrationService.testPowerBi(customUrl, userId);
    return successResponse(res, result, 'Power BI report URL validation completed.', 200);
  } catch (err) {
    const status = err.status || 500;
    return errorResponse(res, err.message, err.code || 'POWER_BI_TEST_ERROR', status);
  }
}

export async function testAll(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const results = await azureIntegrationService.testAllIntegrations(userId);
    return successResponse(res, results, 'All Azure integration tests completed.', 200);
  } catch (err) {
    const status = err.status || 500;
    return errorResponse(res, err.message, err.code || 'TEST_ALL_ERROR', status);
  }
}

export async function authorizeSql(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const result = await azureIntegrationService.authorizeSqlDatabase(userId, req.body || {});
    return successResponse(res, result, 'Azure SQL authorization commands executed successfully.', 200);
  } catch (err) {
    const status = err.status || 500;
    return errorResponse(res, err.message, err.code || 'SQL_AUTHORIZE_ERROR', status);
  }
}

export async function assignBlobRole(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const result = await azureIntegrationService.assignBlobStorageRole(userId, req.body || {});
    return successResponse(res, result, 'Storage Blob Data Contributor role assigned successfully.', 200);
  } catch (err) {
    const status = err.status || 500;
    return errorResponse(res, err.message, err.code || 'BLOB_ROLE_ASSIGN_ERROR', status);
  }
}

export async function assignKeyVaultRole(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const result = await azureIntegrationService.assignKeyVaultRole(userId, req.body || {});
    return successResponse(res, result, 'Key Vault Secrets User role assigned successfully.', 200);
  } catch (err) {
    const status = err.status || 500;
    return errorResponse(res, err.message, err.code || 'KEY_VAULT_ROLE_ASSIGN_ERROR', status);
  }
}

export async function restartAppService(req, res) {
  try {
    const userId = req.user?.user_id || null;
    const result = await azureIntegrationService.restartAppService(userId, req.body || {});
    return successResponse(res, result, 'App Service environment synchronized and runtime reloaded.', 200);
  } catch (err) {
    const status = err.status || 500;
    return errorResponse(res, err.message, err.code || 'APP_SERVICE_RESTART_ERROR', status);
  }
}

export default {
  getIntegrations,
  getStatus,
  updatePreferences,
  testSql,
  testBlob,
  testKeyVault,
  testPowerBi,
  testAll,
  authorizeSql,
  assignBlobRole,
  assignKeyVaultRole,
  restartAppService
};

