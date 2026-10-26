import scannerService from '../services/scanner/scannerService.js';
import scanRepository from '../repositories/scanRepository.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

export async function initiateScan(req, res) {
  if (!req.file) {
    return errorResponse(res, 'No file uploaded. Please select a valid .txt, .json, or .csv file.', 'NO_FILE_UPLOADED', 400);
  }

  // Sanitize filename to prevent directory traversal
  const rawFilename = req.file.originalname || 'upload.txt';
  const cleanFilename = rawFilename.replace(/^.*[\\/]/, '');

  try {
    const result = await scannerService.executeScan({
      userId: req.user.user_id,
      filename: cleanFilename,
      buffer: req.file.buffer
    });

    return successResponse(res, result, null, 201);
  } catch (err) {
    const statusCode = err.status || 400;
    return errorResponse(res, err.message, err.code || 'SCAN_ERROR', statusCode);
  }
}

export async function getScans(req, res) {
  const limit = Math.min(parseInt(req.query.limit || '50', 10), 100);
  const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);

  const scans = await scanRepository.listScans({ limit, offset });
  return successResponse(res, scans, { limit, offset, count: scans.length }, 200);
}

export async function getScanDetails(req, res) {
  const scanId = req.params.id;
  const scan = await scanRepository.getScanById(scanId);

  if (!scan) {
    return errorResponse(res, `Scan with ID "${scanId}" not found.`, 'RESOURCE_NOT_FOUND', 404);
  }

  return successResponse(res, scan, null, 200);
}

export async function getScanFindingsList(req, res) {
  const scanId = req.params.id;
  const scan = await scanRepository.getScanById(scanId);

  if (!scan) {
    return errorResponse(res, `Scan with ID "${scanId}" not found.`, 'RESOURCE_NOT_FOUND', 404);
  }

  const findings = await scanRepository.getScanFindings(scanId);
  return successResponse(res, findings, { scan_id: scanId, count: findings.length }, 200);
}

export async function clearAllData(_req, res) {
  await scanRepository.clearAllScanData();
  return successResponse(res, { message: 'All operational scans, findings, and incidents cleared.' }, null, 200);
}

export default {
  initiateScan,
  getScans,
  getScanDetails,
  getScanFindingsList,
  clearAllData
};
