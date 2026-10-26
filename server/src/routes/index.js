import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import scanRoutes from './scan.routes.js';
import findingRoutes from './finding.routes.js';
import analyticsRoutes from './analytics.routes.js';
import auditRoutes from './audit.routes.js';
import incidentRoutes from './incident.routes.js';
import { successResponse } from '../utils/apiResponse.js';

const apiRouter = Router();

// Operational health endpoint
apiRouter.use('/health', healthRoutes);

// Phase 2 & 3 Functional Routes
apiRouter.use('/auth', authRoutes);
apiRouter.use('/scans', scanRoutes);
apiRouter.use('/findings', findingRoutes);
apiRouter.use('/incidents', incidentRoutes);
apiRouter.use('/analytics', analyticsRoutes);
apiRouter.use('/audit-logs', auditRoutes);

// Phase 4+ Placeholders
const futureModules = [
  { path: '/rules', name: 'Dynamic Custom Detection Rule Authoring' }
];

for (const mod of futureModules) {
  apiRouter.all(mod.path, (req, res) => {
    return successResponse(
      res,
      {
        module: mod.name,
        phase: 'Scheduled for Phase 3',
        status: 'Under Development'
      },
      null,
      200
    );
  });
}

export default apiRouter;
