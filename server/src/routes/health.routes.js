import { Router } from 'express';
import { checkDatabaseHealth } from '../database/connection.js';
import { checkStorageHealth } from '../services/storage/blobStorageService.js';
import { checkKeyVaultHealth } from '../services/cloud/keyVaultService.js';
import { successResponse } from '../utils/apiResponse.js';
import env from '../config/env.js';

const router = Router();
const startTime = Date.now();

/**
 * GET /api/health
 * Liveness probe: verifies that the Express event loop is operational and responsive.
 * Used by Azure App Service health probe and external uptime monitors.
 * Retains backward-compatible component metadata while redacting all secrets.
 */
router.get('/', async (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - startTime) / 1000);
  const dbHealth = await checkDatabaseHealth();
  const isHealthy = dbHealth.isHealthy;
  const status = isHealthy ? 'healthy' : 'degraded';

  const healthData = {
    status,
    timestamp: new Date().toISOString(),
    uptimeSeconds,
    environment: env.NODE_ENV,
    version: '1.0.0',
    components: {
      api: {
        status: 'up'
      },
      database: {
        status: isHealthy ? 'connected' : 'disconnected',
        message: dbHealth.message,
        ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {})
      }
    }
  };

  return successResponse(res, healthData, null, 200);
});

/**
 * GET /api/health/ready
 * Readiness probe: verifies that mandatory external cloud dependencies (SQL, Blob Storage, Key Vault)
 * are connected and capable of accepting traffic before routing end-user requests.
 * Returns HTTP 200 when ready, HTTP 503 when dependencies are unreachable.
 * Never exposes credentials, connection strings, or internal infrastructure details.
 */
router.get('/ready', async (req, res) => {
  const [dbHealth, storageHealth, keyVaultHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkStorageHealth(),
    checkKeyVaultHealth()
  ]);

  // In production, database is a mandatory dependency. In dev/test, fallback mode is accepted.
  const isDbReady = env.IS_PRODUCTION ? dbHealth.isHealthy : true;
  const isStorageReady = storageHealth.isHealthy;
  const isKeyVaultReady = keyVaultHealth.isHealthy;

  const isReady = isDbReady && isStorageReady && isKeyVaultReady;
  const httpStatus = isReady ? 200 : 503;

  const payload = {
    status: isReady ? 'ready' : 'not_ready',
    ready: isReady,
    timestamp: new Date().toISOString(),
    dependencies: {
      database: {
        ready: dbHealth.isHealthy,
        status: dbHealth.isHealthy ? 'connected' : 'disconnected',
        message: dbHealth.message,
        ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {})
      },
      storage: {
        ready: storageHealth.isHealthy,
        status: storageHealth.configured ? 'connected' : 'local_fallback',
        container: storageHealth.container,
        message: storageHealth.message
      },
      secrets: {
        ready: keyVaultHealth.isHealthy,
        status: keyVaultHealth.configured ? 'key_vault_connected' : 'environment_secrets',
        message: keyVaultHealth.message
      }
    }
  };

  return res.status(httpStatus).json(payload);
});

export default router;
