import { Router } from 'express';
import { authenticateToken, requireRole, ROLES } from '../middleware/auth.js';
import { integrationRateLimiter } from '../middleware/rateLimiter.js';
import * as integrationController from '../controllers/integrationController.js';

const router = Router();

// All integration endpoints require valid authentication, ADMIN privileges, and rate limiting
router.use(authenticateToken);
router.use(requireRole([ROLES.ADMIN]));
router.use(integrationRateLimiter);

// Integration configuration & overview
router.get('/', integrationController.getIntegrations);
router.put('/preferences', integrationController.updatePreferences);
router.get('/status', integrationController.getStatus);

// Connection tests
router.post('/sql/test', integrationController.testSql);
router.post('/blob/test', integrationController.testBlob);
router.post('/key-vault/test', integrationController.testKeyVault);
router.post('/power-bi/test', integrationController.testPowerBi);
router.post('/test-all', integrationController.testAll);

// In-Platform Cloud Role Authorization & Runtime Synchronization
router.post('/sql/authorize', integrationController.authorizeSql);
router.post('/blob/assign-role', integrationController.assignBlobRole);
router.post('/key-vault/assign-role', integrationController.assignKeyVaultRole);
router.post('/app-service/restart', integrationController.restartAppService);

export default router;
