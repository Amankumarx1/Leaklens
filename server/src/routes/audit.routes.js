import { Router } from 'express';
import analyticsController from '../controllers/analyticsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, analyticsController.getAuditTrail);

export default router;
