import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import {
  listIncidents,
  createIncident,
  getIncident,
  assignIncident,
  transitionStatus,
  recordAction,
  getActions,
  recordVerification,
  resolveIncident,
  reopenIncident,
  associateFinding,
  disassociateFinding,
  getMetrics,
  getUnassociatedFindings,
  getEligibleAssignees
} from '../controllers/incidentController.js';

const router = express.Router();

// All incident routes require authentication
router.use(authenticateToken);

// Collection & utility endpoints
router.get('/', listIncidents);
router.post('/', requireRole(['ADMIN', 'ANALYST']), createIncident);
router.get('/metrics', getMetrics);
router.get('/unassociated-findings', requireRole(['ADMIN', 'ANALYST']), getUnassociatedFindings);
router.get('/assignees', requireRole(['ADMIN', 'ANALYST']), getEligibleAssignees);

// Single incident & lifecycle actions
router.get('/:id', getIncident);
router.patch('/:id/assignment', requireRole(['ADMIN', 'ANALYST']), assignIncident);
router.patch('/:id/status', requireRole(['ADMIN', 'ANALYST']), transitionStatus);
router.post('/:id/actions', requireRole(['ADMIN', 'ANALYST']), recordAction);
router.get('/:id/actions', getActions);
router.post('/:id/verify', requireRole(['ADMIN', 'ANALYST']), recordVerification);
router.post('/:id/resolve', requireRole(['ADMIN', 'ANALYST']), resolveIncident);
router.post('/:id/reopen', requireRole(['ADMIN', 'ANALYST']), reopenIncident);
router.post('/:id/findings', requireRole(['ADMIN', 'ANALYST']), associateFinding);
router.delete('/:id/findings/:findingId', requireRole(['ADMIN', 'ANALYST']), disassociateFinding);

export default router;
