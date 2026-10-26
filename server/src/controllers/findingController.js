import findingRepository from '../repositories/findingRepository.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export async function getFindings(req, res) {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

  const { severity, category, status, scanId } = req.query;

  const result = await findingRepository.listFindings({
    severity,
    category,
    status,
    scanId,
    limit,
    offset
  });

  return successResponse(res, result.findings, {
    total: result.total,
    limit,
    offset,
    returned: result.findings.length
  }, 200);
}

export async function getFindingDetails(req, res) {
  const findingId = req.params.id;
  const finding = await findingRepository.getFindingById(findingId);

  if (!finding) {
    return errorResponse(res, `Finding with ID "${findingId}" not found.`, 'RESOURCE_NOT_FOUND', 404);
  }

  return successResponse(res, finding, null, 200);
}

export default {
  getFindings,
  getFindingDetails
};
