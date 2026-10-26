import findingRepository from '../repositories/findingRepository.js';
import auditRepository from '../repositories/auditRepository.js';
import { successResponse } from '../utils/apiResponse.js';

export async function getDashboardAnalytics(req, res) {
  const metrics = await findingRepository.getDashboardMetrics();
  return successResponse(res, metrics, null, 200);
}

export async function getAuditTrail(req, res) {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

  const logs = await auditRepository.listAuditLogs({ limit, offset });
  return successResponse(res, logs, { limit, offset, count: logs.length }, 200);
}

export default {
  getDashboardAnalytics,
  getAuditTrail
};
