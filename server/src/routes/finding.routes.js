import { Router } from 'express';
import findingController from '../controllers/findingController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticateToken, findingController.getFindings);
router.get('/:id', authenticateToken, findingController.getFindingDetails);

export default router;
