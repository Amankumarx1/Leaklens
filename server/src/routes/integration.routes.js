import { Router } from 'express';
import { authenticateToken, requireRole, ROLES } from '../middleware/auth.js';
import * as integrationController from '../controllers/integrationController.js';

const router = Router();

// All integration endpoints require valid authentication and ADMIN privileges
router.use(authenticateToken);
router.use(requireRole([ROLES.ADMIN]));

// Integration configuration & overview
router.get('/', integrationController.getIntegrations);
router.put('/preferences', integrationController.updatePreferences);
router.get('/status', integrationController.getStatus);

// Connection tests
router.post('/sql/test', integrationController.testSql);
router.post('/blob/test', integrationController.testBlob);
router.post('/key-vault/test', integrationController.testKeyVault);
router.post('/power-bi/test', integrationController.testPowerBi);

export default router;
