import { Router } from 'express';
import { checkDatabaseHealth } from '../database/connection.js';
import { successResponse } from '../utils/apiResponse.js';
import env from '../config/env.js';

const router = Router();
const startTime = Date.now();

/**
 * GET /api/health
 * Operational health check for load balancers, orchestrators, and UI status indicator.
 * Provides live system uptime, environment mode, and verifiable DB connectivity.
 * Redacts connection details, credentials, and internal hostnames.
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

export default router;
