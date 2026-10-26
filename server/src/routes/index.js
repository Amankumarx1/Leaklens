import { Router } from 'express';
import healthRoutes from './health.routes.js';
import { successResponse } from '../utils/apiResponse.js';

const apiRouter = Router();

// Operational health endpoint
apiRouter.use('/health', healthRoutes);

// Foundation placeholder endpoints for subsequent phases
// Explains clearly that these workflows will be developed in future phases
const placeholderModules = [
  { path: '/scans', name: 'Scanner Engine & Jobs' },
  { path: '/findings', name: 'Findings & Redaction Management' },
  { path: '/incidents', name: 'Incident Response & Assignment' },
  { path: '/analytics', name: 'Security Exposure Analytics' },
  { path: '/audit-logs', name: 'Defensive Audit Trail' },
  { path: '/rules', name: 'Detection Rules & Signatures' },
  { path: '/auth', name: 'Role-Based Authentication & Access Control' }
];

for (const mod of placeholderModules) {
  apiRouter.all(mod.path, (req, res) => {
    return successResponse(
      res,
      {
        module: mod.name,
        phase: 'Phase 1 Foundation Established',
        status: 'Under Development (Scheduled for Subsequent Phase)',
        availableActions: ['GET /api/health']
      },
      null,
      200
    );
  });
}

export default apiRouter;
