import { Router } from 'express';
import authController from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

router.post('/login', authRateLimiter, authController.login);
router.post('/logout', authController.logout);
router.get('/me', authenticateToken, authController.getProfile);

export default router;
