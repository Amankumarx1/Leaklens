import crypto from 'crypto';
import { executeQuery, checkDatabaseHealth } from '../database/connection.js';
import memoryStore from './memoryStore.js';

export async function createScanJob({ scan_id, created_by, status = 'in_progress' }) {
  const id = scan_id || crypto.randomUUID();
  const now = new Date().toISOString();

  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    await executeQuery(
      `INSERT INTO leaklens.scan_jobs (scan_id, created_by, status, started_at, created_at)
       VALUES (@scan_id, @created_by, @status, @started_at, @created_at)`,
      {
        scan_id: id,
        created_by,
        status,
        started_at: now,
        created_at: now
      }
    );
  } else {
    memoryStore.scan_jobs.push({
      scan_id: id,
      created_by,
      status,
      started_at: now,
      completed_at: null,
      error_code: null,
      created_at: now
    });
  }

  return { scan_id: id, status, started_at: now };
}

export async function createFileRecord({ file_id, scan_id, original_filename, blob_path = null, content_hash, file_size_bytes, mime_type }) {
  const id = file_id || crypto.randomUUID();
  const now = new Date().toISOString();

  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    await executeQuery(
      `INSERT INTO leaklens.files (file_id, scan_id, original_filename, blob_path, content_hash, file_size_bytes, mime_type, created_at)
       VALUES (@file_id, @scan_id, @original_filename, @blob_path, @content_hash, @file_size_bytes, @mime_type, @created_at)`,
      {
        file_id: id,
        scan_id,
        original_filename,
        blob_path,
        content_hash,
        file_size_bytes,
        mime_type,
        created_at: now
      }
    );
  } else {
    memoryStore.files.push({
      file_id: id,
      scan_id,
      original_filename,
      blob_path,
      content_hash,
      file_size_bytes,
      mime_type,
      created_at: now
    });
  }

  return { file_id: id, blob_path };
}

export async function createFindingsBatch(file_id, findings = []) {
  if (!findings || findings.length === 0) return [];
  const createdFindings = [];
  const now = new Date().toISOString();

  const dbHealth = await checkDatabaseHealth();

  for (const finding of findings) {
    const finding_id = crypto.randomUUID();
    const findingRecord = {
      finding_id,
      file_id,
      rule_id: finding.rule_id,
      location_reference: finding.location_reference,
      field_path: finding.field_path || null,
      masked_excerpt: finding.masked_excerpt,
      secret_fingerprint: finding.secret_fingerprint || null,
      severity: finding.severity,
      confidence: finding.confidence || 'high',
      status: finding.status || 'detected',
      detected_at: now
    };

    if (dbHealth.isHealthy) {
      await executeQuery(
        `INSERT INTO leaklens.findings (finding_id, file_id, rule_id, location_reference, field_path, masked_excerpt, secret_fingerprint, severity, confidence, status, detected_at)
         VALUES (@finding_id, @file_id, @rule_id, @location_reference, @field_path, @masked_excerpt, @secret_fingerprint, @severity, @confidence, @status, @detected_at)`,
        findingRecord
      );
    } else {
      memoryStore.findings.push({
        ...findingRecord,
        rule_name: finding.rule_name,
        category: finding.category
      });
    }

    createdFindings.push({
      ...findingRecord,
      rule_name: finding.rule_name,
      category: finding.category
    });
  }

  return createdFindings;
}

export async function updateScanStatus(scan_id, { status, error_code = null }) {
  const completed_at = new Date().toISOString();

  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    await executeQuery(
      `UPDATE leaklens.scan_jobs 
       SET status = @status, completed_at = @completed_at, error_code = @error_code 
       WHERE scan_id = @scan_id`,
      { scan_id, status, completed_at, error_code }
    );
  } else {
    const job = memoryStore.scan_jobs.find(j => j.scan_id === scan_id);
    if (job) {
      job.status = status;
      job.completed_at = completed_at;
      job.error_code = error_code;
    }
  }

  return { scan_id, status, completed_at };
}

export async function listScans({ limit = 50, offset = 0 } = {}) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT 
         sj.scan_id,
         sj.status,
         sj.started_at,
         sj.completed_at,
         sj.created_at,
         sj.error_code,
         u.display_name AS created_by_name,
         u.email AS created_by_email,
         fl.original_filename,
         fl.file_size_bytes,
         fl.mime_type,
         COUNT(f.finding_id) AS total_findings
       FROM leaklens.scan_jobs sj
       LEFT JOIN leaklens.users u ON sj.created_by = u.user_id
       LEFT JOIN leaklens.files fl ON sj.scan_id = fl.scan_id
       LEFT JOIN leaklens.findings f ON fl.file_id = f.file_id
       GROUP BY 
         sj.scan_id, sj.status, sj.started_at, sj.completed_at, sj.created_at, sj.error_code,
         u.display_name, u.email, fl.original_filename, fl.file_size_bytes, fl.mime_type
       ORDER BY sj.created_at DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { limit, offset }
    );
    return result.recordset || [];
  }

  // Memory fallback with join simulation
  return memoryStore.scan_jobs
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(offset, offset + limit)
    .map(job => {
      const user = memoryStore.users.find(u => u.user_id === job.created_by);
      const file = memoryStore.files.find(f => f.scan_id === job.scan_id);
      const findingCount = file
        ? memoryStore.findings.filter(f => f.file_id === file.file_id).length
        : 0;

      return {
        ...job,
        created_by_name: user?.display_name || 'System',
        created_by_email: user?.email || '',
        original_filename: file?.original_filename || 'unknown_file',
        file_size_bytes: file?.file_size_bytes || 0,
        mime_type: file?.mime_type || 'text/plain',
        total_findings: findingCount
      };
    });
}

export async function getScanById(scan_id) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT 
         sj.scan_id,
         sj.status,
         sj.started_at,
         sj.completed_at,
         sj.created_at,
         sj.error_code,
         u.display_name AS created_by_name,
         u.email AS created_by_email,
         fl.file_id,
         fl.original_filename,
         fl.blob_path,
         fl.content_hash,
         fl.file_size_bytes,
         fl.mime_type
       FROM leaklens.scan_jobs sj
       LEFT JOIN leaklens.users u ON sj.created_by = u.user_id
       LEFT JOIN leaklens.files fl ON sj.scan_id = fl.scan_id
       WHERE sj.scan_id = @scan_id`,
      { scan_id }
    );
    return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
  }

  const job = memoryStore.scan_jobs.find(j => j.scan_id === scan_id);
  if (!job) return null;

  const user = memoryStore.users.find(u => u.user_id === job.created_by);
  const file = memoryStore.files.find(f => f.scan_id === job.scan_id);

  return {
    ...job,
    created_by_name: user?.display_name || 'System',
    created_by_email: user?.email || '',
    file_id: file?.file_id,
    original_filename: file?.original_filename || 'unknown_file',
    blob_path: file?.blob_path || null,
    content_hash: file?.content_hash || '',
    file_size_bytes: file?.file_size_bytes || 0,
    mime_type: file?.mime_type || 'text/plain'
  };
}

export async function getScanFindings(scan_id) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT 
         f.finding_id,
         f.file_id,
         f.rule_id,
         dr.rule_name,
         dr.category,
         f.location_reference,
         f.masked_excerpt,
         f.severity,
         f.status,
         f.detected_at
       FROM leaklens.findings f
       INNER JOIN leaklens.files fl ON f.file_id = fl.file_id
       INNER JOIN leaklens.detection_rules dr ON f.rule_id = dr.rule_id
       WHERE fl.scan_id = @scan_id
       ORDER BY f.detected_at ASC`,
      { scan_id }
    );
    return result.recordset || [];
  }

  const file = memoryStore.files.find(f => f.scan_id === scan_id);
  if (!file) return [];

  return memoryStore.findings
    .filter(f => f.file_id === file.file_id)
    .map(f => {
      const rule = memoryStore.detection_rules.find(r => r.rule_id === f.rule_id);
      return {
        ...f,
        rule_name: rule?.rule_name || f.rule_name || 'RULE',
        category: rule?.category || f.category || 'EXPOSURE'
      };
    });
}

export async function clearAllScanData() {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    try {
      await executeQuery(`
        DELETE FROM leaklens.remediation_actions;
        DELETE FROM leaklens.incident_findings;
        DELETE FROM leaklens.incidents;
        DELETE FROM leaklens.findings;
        DELETE FROM leaklens.files;
        DELETE FROM leaklens.scan_jobs;
      `);
    } catch {
      // Ignore if table doesn't exist
    }
  }

  // Clear memory store data
  memoryStore.scan_jobs = [];
  memoryStore.files = [];
  memoryStore.findings = [];
  memoryStore.incidents = [];
  memoryStore.incident_findings = [];
  memoryStore.remediation_actions = [];
  memoryStore.audit_logs = [];

  return { cleared: true };
}

export default {
  createScanJob,
  createFileRecord,
  createFindingsBatch,
  updateScanStatus,
  listScans,
  getScanById,
  getScanFindings,
  clearAllScanData
};
