import { executeQuery, checkDatabaseHealth } from '../database/connection.js';
import memoryStore from './memoryStore.js';

export async function listFindings({
  severity,
  category,
  status,
  scanId,
  limit = 50,
  offset = 0
} = {}) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const whereClauses = [];
    const params = { limit, offset };

    if (severity) {
      whereClauses.push('f.severity = @severity');
      params.severity = severity.toLowerCase();
    }
    if (category) {
      whereClauses.push('dr.category = @category');
      params.category = category;
    }
    if (status) {
      whereClauses.push('f.status = @status');
      params.status = status;
    }
    if (scanId) {
      whereClauses.push('fl.scan_id = @scanId');
      params.scanId = scanId;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const query = `
      SELECT 
        f.finding_id,
        f.file_id,
        f.rule_id,
        dr.rule_name,
        dr.category,
        f.location_reference,
        f.masked_excerpt,
        f.severity,
        f.status,
        f.detected_at,
        fl.original_filename,
        fl.scan_id
      FROM leaklens.findings f
      INNER JOIN leaklens.files fl ON f.file_id = fl.file_id
      INNER JOIN leaklens.detection_rules dr ON f.rule_id = dr.rule_id
      ${whereSql}
      ORDER BY f.detected_at DESC
      OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
    `;

    const countQuery = `
      SELECT COUNT(f.finding_id) AS total
      FROM leaklens.findings f
      INNER JOIN leaklens.files fl ON f.file_id = fl.file_id
      INNER JOIN leaklens.detection_rules dr ON f.rule_id = dr.rule_id
      ${whereSql}
    `;

    const [itemsResult, countResult] = await Promise.all([
      executeQuery(query, params),
      executeQuery(countQuery, params)
    ]);

    return {
      findings: itemsResult.recordset || [],
      total: countResult.recordset?.[0]?.total || 0,
      limit,
      offset
    };
  }

  // Memory fallback
  let filtered = memoryStore.findings.slice();

  if (severity) {
    filtered = filtered.filter(f => f.severity.toLowerCase() === severity.toLowerCase());
  }
  if (category) {
    filtered = filtered.filter(f => f.category === category);
  }
  if (status) {
    filtered = filtered.filter(f => f.status === status);
  }
  if (scanId) {
    const fileIds = new Set(
      memoryStore.files.filter(file => file.scan_id === scanId).map(file => file.file_id)
    );
    filtered = filtered.filter(f => fileIds.has(f.file_id));
  }

  const total = filtered.length;
  const paginated = filtered
    .sort((a, b) => new Date(b.detected_at) - new Date(a.detected_at))
    .slice(offset, offset + limit)
    .map(f => {
      const file = memoryStore.files.find(fl => fl.file_id === f.file_id);
      const rule = memoryStore.detection_rules.find(r => r.rule_id === f.rule_id);
      return {
        ...f,
        original_filename: file?.original_filename || 'unknown_file',
        scan_id: file?.scan_id || '',
        rule_name: rule?.rule_name || f.rule_name || 'RULE',
        category: rule?.category || f.category || 'EXPOSURE'
      };
    });

  return {
    findings: paginated,
    total,
    limit,
    offset
  };
}

export async function getFindingById(finding_id) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT 
        f.finding_id,
        f.file_id,
        f.rule_id,
        dr.rule_name,
        dr.category,
        dr.description AS rule_description,
        f.location_reference,
        f.masked_excerpt,
        f.severity,
        f.status,
        f.detected_at,
        fl.original_filename,
        fl.content_hash,
        fl.scan_id
      FROM leaklens.findings f
      INNER JOIN leaklens.files fl ON f.file_id = fl.file_id
      INNER JOIN leaklens.detection_rules dr ON f.rule_id = dr.rule_id
      WHERE f.finding_id = @finding_id`,
      { finding_id }
    );
    return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
  }

  const f = memoryStore.findings.find(item => item.finding_id === finding_id);
  if (!f) return null;

  const file = memoryStore.files.find(fl => fl.file_id === f.file_id);
  const rule = memoryStore.detection_rules.find(r => r.rule_id === f.rule_id);

  return {
    ...f,
    original_filename: file?.original_filename || 'unknown_file',
    content_hash: file?.content_hash || '',
    scan_id: file?.scan_id || '',
    rule_name: rule?.rule_name || f.rule_name || 'RULE',
    category: rule?.category || f.category || 'EXPOSURE',
    rule_description: rule?.description || ''
  };
}

export async function getDashboardMetrics() {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const [scansRes, findingsRes, sevRes, catRes] = await Promise.all([
      executeQuery(`SELECT COUNT(*) AS total_scans FROM leaklens.scan_jobs WHERE status = 'completed'`),
      executeQuery(`SELECT COUNT(*) AS total_findings FROM leaklens.findings`),
      executeQuery(`SELECT severity, COUNT(*) AS count FROM leaklens.findings GROUP BY severity`),
      executeQuery(`
        SELECT dr.category, COUNT(f.finding_id) AS count 
        FROM leaklens.findings f 
        INNER JOIN leaklens.detection_rules dr ON f.rule_id = dr.rule_id 
        GROUP BY dr.category
      `)
    ]);

    const severityMap = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    (sevRes.recordset || []).forEach(row => {
      severityMap[row.severity.toLowerCase()] = row.count;
    });

    const categoryMap = {};
    (catRes.recordset || []).forEach(row => {
      categoryMap[row.category] = row.count;
    });

    return {
      totalCompletedScans: scansRes.recordset?.[0]?.total_scans || 0,
      totalFindings: findingsRes.recordset?.[0]?.total_findings || 0,
      findingsBySeverity: severityMap,
      findingsByCategory: categoryMap
    };
  }

  // Memory fallback
  const totalCompletedScans = memoryStore.scan_jobs.filter(s => s.status === 'completed').length;
  const totalFindings = memoryStore.findings.length;

  const findingsBySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  const findingsByCategory = {};

  memoryStore.findings.forEach(f => {
    const sev = (f.severity || 'low').toLowerCase();
    findingsBySeverity[sev] = (findingsBySeverity[sev] || 0) + 1;

    const cat = f.category || 'OTHER';
    findingsByCategory[cat] = (findingsByCategory[cat] || 0) + 1;
  });

  return {
    totalCompletedScans,
    totalFindings,
    findingsBySeverity,
    findingsByCategory
  };
}

export default {
  listFindings,
  getFindingById,
  getDashboardMetrics
};
