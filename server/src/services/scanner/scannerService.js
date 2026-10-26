import crypto from 'crypto';
import { parseFileContent } from './parsers/parserFactory.js';
import { scanItems } from './scannerEngine.js';
import ruleRepository from '../../repositories/ruleRepository.js';
import scanRepository from '../../repositories/scanRepository.js';
import auditRepository from '../../repositories/auditRepository.js';
import { generateSafeBlobPath, uploadFile, deleteBlob } from '../storage/blobStorageService.js';

/**
 * Orchestrates the end-to-end scanning lifecycle:
 * Parse -> Upload to Private Storage -> Load Rules -> Detect & Mask -> Persist Scan & Findings -> Audit Trail
 *
 * Implements compensating cleanup if any downstream SQL or processing failure occurs,
 * ensuring no orphaned storage objects remain in Azure Blob Storage.
 *
 * @param {object} params
 * @param {string} params.userId - Authenticated user initiating the scan
 * @param {string} params.filename - Uploaded filename
 * @param {Buffer} params.buffer - Uploaded file content buffer
 * @returns {Promise<object>} Scan results summary with persisted IDs
 */
export async function executeScan({ userId, filename, buffer }) {
  if (!buffer || buffer.length === 0) {
    const err = new Error('File content is empty');
    err.code = 'EMPTY_FILE';
    err.status = 400;
    throw err;
  }

  // Compute SHA-256 hash for content fingerprinting and deduplication
  const contentHash = crypto.createHash('sha256').update(buffer).digest('hex');
  const scanId = crypto.randomUUID();
  const fileId = crypto.randomUUID();
  let uploadedBlobPath = null;

  // 1. Initialize Scan Job Record (status: in_progress)
  await scanRepository.createScanJob({
    scan_id: scanId,
    created_by: userId,
    status: 'in_progress'
  });

  // Log scan creation audit event
  await auditRepository.createAuditEntry({
    user_id: userId,
    event_type: 'scan_created',
    entity_type: 'scan_job',
    entity_id: scanId,
    metadata: { filename, file_size_bytes: buffer.length }
  });

  try {
    // 2. Parse File Content based on extension (.txt, .json, .csv)
    const parsed = parseFileContent(filename, buffer);

    // 3. Store file in Private Azure Blob Storage with randomized, non-reversible path
    const safeBlobPath = generateSafeBlobPath(scanId, fileId);
    await uploadFile({
      blobPath: safeBlobPath,
      buffer,
      mimeType: parsed.mimeType,
      metadata: {
        scan_id: scanId,
        file_id: fileId,
        content_hash: contentHash
      }
    });
    uploadedBlobPath = safeBlobPath;

    // 4. Persist File Metadata Record with storage blob reference
    await scanRepository.createFileRecord({
      file_id: fileId,
      scan_id: scanId,
      original_filename: filename,
      blob_path: safeBlobPath,
      content_hash: contentHash,
      file_size_bytes: buffer.length,
      mime_type: parsed.mimeType
    });

    // 5. Load Active Detection Rules from Database/Repository
    const rules = await ruleRepository.getEnabledRules();

    // 6. Run Detection Engine & Mask Excerpts
    const rawFindings = scanItems(parsed.items, rules);

    // 7. Persist Findings Batch to Relational Database
    const persistedFindings = await scanRepository.createFindingsBatch(fileId, rawFindings);

    // 8. Complete Scan Job
    await scanRepository.updateScanStatus(scanId, {
      status: 'completed'
    });

    // 9. Log scan completion audit event
    await auditRepository.createAuditEntry({
      user_id: userId,
      event_type: 'scan_completed',
      entity_type: 'scan_job',
      entity_id: scanId,
      metadata: {
        filename,
        total_findings: persistedFindings.length,
        status: 'completed'
      }
    });

    return {
      scan_id: scanId,
      status: 'completed',
      file: {
        file_id: fileId,
        original_filename: filename,
        blob_path: safeBlobPath,
        content_hash: contentHash,
        file_size_bytes: buffer.length,
        mime_type: parsed.mimeType
      },
      summary: {
        total_findings: persistedFindings.length,
        critical: persistedFindings.filter(f => f.severity === 'critical').length,
        high: persistedFindings.filter(f => f.severity === 'high').length,
        medium: persistedFindings.filter(f => f.severity === 'medium').length,
        low: persistedFindings.filter(f => f.severity === 'low').length
      },
      findings: persistedFindings
    };
  } catch (err) {
    // Compensating Cleanup: Delete uploaded blob if downstream parsing, rules, or DB fails
    if (uploadedBlobPath) {
      try {
        await deleteBlob(uploadedBlobPath);
      } catch (cleanupErr) {
        console.warn(`[Compensating Storage Cleanup Failed]: ${cleanupErr.message}`);
      }
    }

    // Fail-safe transition to failed state
    await scanRepository.updateScanStatus(scanId, {
      status: 'failed',
      error_code: err.code || 'SCAN_PROCESSING_ERROR'
    });

    await auditRepository.createAuditEntry({
      user_id: userId,
      event_type: 'scan_failed',
      entity_type: 'scan_job',
      entity_id: scanId,
      metadata: {
        filename,
        error_code: err.code || 'SCAN_PROCESSING_ERROR'
      }
    });

    throw err;
  }
}

export default {
  executeScan
};
