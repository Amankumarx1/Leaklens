import crypto from 'crypto';
import { executeQuery, checkDatabaseHealth } from '../database/connection.js';
import memoryStore from './memoryStore.js';
import cacheService from '../services/cache/cacheService.js';

export async function listFindings({
  severity,
  confidence,
  category,
  status,
  scanId,
  limit = 50,
  offset = 0
} = {}) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const conditions = [];
    const params = { limit, offset };

    if (severity) {
      conditions.push('f.severity = @severity');
      params.severity = severity;
    }
    if (confidence) {
      conditions.push('f.confidence = @confidence');
      params.confidence = confidence;
    }
    if (category) {
      conditions.push('dr.category = @category');
      params.category = category;
    }
    if (status) {
      conditions.push('f.status = @status');
      params.status = status;
    }
    if (scanId) {
      conditions.push('fl.scan_id = @scanId');
      params.scanId = scanId;
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        f.finding_id,
        f.file_id,
        f.rule_id,
        dr.rule_name,
        dr.category,
        f.location_reference,
        f.field_path,
        f.masked_excerpt,
        f.severity,
        COALESCE(f.confidence, 'high') AS confidence,
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
  if (confidence) {
    filtered = filtered.filter(f => (f.confidence || 'high').toLowerCase() === confidence.toLowerCase());
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
        confidence: f.confidence || 'high',
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
        f.field_path,
        f.masked_excerpt,
        f.secret_fingerprint,
        f.severity,
        COALESCE(f.confidence, 'high') AS confidence,
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
    return result.recordset?.[0] || null;
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
  const computeMetrics = async () => {
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.isHealthy) {
      const [
        scansRes,
        findingsRes,
        sevRes,
        catRes,
        findingStatusRes,
        incidentsRes,
        incPriorityRes,
        rulesRes,
        mttrRes
      ] = await Promise.all([
        executeQuery(`SELECT status, COUNT(*) AS count FROM leaklens.scan_jobs GROUP BY status`),
        executeQuery(`SELECT COUNT(*) AS total_findings FROM leaklens.findings`),
        executeQuery(`SELECT severity, COUNT(*) AS count FROM leaklens.findings GROUP BY severity`),
        executeQuery(`
          SELECT dr.category, COUNT(f.finding_id) AS count 
          FROM leaklens.findings f 
          INNER JOIN leaklens.detection_rules dr ON f.rule_id = dr.rule_id 
          GROUP BY dr.category
        `),
        executeQuery(`SELECT status, COUNT(*) AS count FROM leaklens.findings GROUP BY status`),
        executeQuery(`
          SELECT 
            COUNT(*) AS total_incidents,
            SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
            SUM(CASE WHEN status = 'pending_verification' THEN 1 ELSE 0 END) AS pending_verification_count,
            SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
            SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
            SUM(CASE WHEN assigned_to IS NULL THEN 1 ELSE 0 END) AS unassigned_count
          FROM leaklens.incidents
        `),
        executeQuery(`SELECT priority, COUNT(*) AS count FROM leaklens.incidents GROUP BY priority`),
        executeQuery(`
          SELECT dr.rule_id, dr.rule_name, dr.category, dr.severity, COUNT(f.finding_id) AS match_count
          FROM leaklens.detection_rules dr
          LEFT JOIN leaklens.findings f ON dr.rule_id = f.rule_id
          GROUP BY dr.rule_id, dr.rule_name, dr.category, dr.severity
        `),
        executeQuery(`
          SELECT 
            COUNT(incident_id) AS resolved_count,
            AVG(DATEDIFF(SECOND, created_at, resolved_at) / 3600.0) AS avg_hours,
            AVG(DATEDIFF(MINUTE, created_at, resolved_at)) AS avg_minutes
          FROM leaklens.incidents
          WHERE status IN ('resolved', 'closed') AND resolved_at IS NOT NULL
        `)
      ]);

      const scansMap = { total: 0, completed: 0, failed: 0, in_progress: 0, queued: 0 };
      (scansRes.recordset || []).forEach(row => {
        const s = row.status?.toLowerCase() || 'other';
        scansMap[s] = row.count;
        scansMap.total += row.count;
      });

      const severityMap = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
      (sevRes.recordset || []).forEach(row => {
        severityMap[row.severity?.toLowerCase() || 'low'] = row.count;
      });

      const categoryMap = {};
      (catRes.recordset || []).forEach(row => {
        categoryMap[row.category] = row.count;
      });

      const findingStatusMap = { detected: 0, confirmed: 0, remediated: 0, suppressed: 0 };
      (findingStatusRes.recordset || []).forEach(row => {
        findingStatusMap[row.status?.toLowerCase() || 'detected'] = row.count;
      });

      const incSummary = incidentsRes.recordset?.[0] || {};
      const incPriorityMap = { critical: 0, high: 0, medium: 0, low: 0 };
      (incPriorityRes.recordset || []).forEach(row => {
        incPriorityMap[row.priority?.toLowerCase() || 'medium'] = row.count;
      });

      const mttrData = mttrRes.recordset?.[0] || {};

      return {
        totalCompletedScans: scansMap.completed || 0,
        totalFindings: findingsRes.recordset?.[0]?.total_findings || 0,
        findingsBySeverity: severityMap,
        findingsByCategory: categoryMap,
        scans: scansMap,
        findingsByStatus: findingStatusMap,
        incidents: {
          total: incSummary.total_incidents || 0,
          open: incSummary.open_count || 0,
          in_progress: incSummary.in_progress_count || 0,
          pending_verification: incSummary.pending_verification_count || 0,
          resolved: incSummary.resolved_count || 0,
          closed: incSummary.closed_count || 0,
          unassigned: incSummary.unassigned_count || 0,
          byPriority: incPriorityMap
        },
        mttr: {
          avgHours: mttrData.avg_hours ? Number(mttrData.avg_hours.toFixed(2)) : 0,
          avgMinutes: mttrData.avg_minutes ? Math.round(mttrData.avg_minutes) : 0,
          resolvedCases: mttrData.resolved_count || 0
        },
        rules: rulesRes.recordset || []
      };
    }

    // Memory fallback
    const scansMap = { total: memoryStore.scan_jobs.length, completed: 0, failed: 0, in_progress: 0, queued: 0 };
    memoryStore.scan_jobs.forEach(s => {
      const st = s.status?.toLowerCase() || 'other';
      scansMap[st] = (scansMap[st] || 0) + 1;
    });

    const totalCompletedScans = scansMap.completed || 0;
    const totalFindings = memoryStore.findings.length;

    const findingsBySeverity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    const findingsByCategory = {};
    const findingsByStatus = { detected: 0, confirmed: 0, remediated: 0, suppressed: 0 };

    memoryStore.findings.forEach(f => {
      const sev = (f.severity || 'low').toLowerCase();
      findingsBySeverity[sev] = (findingsBySeverity[sev] || 0) + 1;

      const cat = f.category || 'OTHER';
      findingsByCategory[cat] = (findingsByCategory[cat] || 0) + 1;

      const st = (f.status || 'detected').toLowerCase();
      findingsByStatus[st] = (findingsByStatus[st] || 0) + 1;
    });

    const incSummary = {
      total: memoryStore.incidents.length,
      open: 0,
      in_progress: 0,
      pending_verification: 0,
      resolved: 0,
      closed: 0,
      unassigned: 0,
      byPriority: { critical: 0, high: 0, medium: 0, low: 0 }
    };

    let totalDurationMinutes = 0;
    let resolvedCount = 0;

    memoryStore.incidents.forEach(inc => {
      const st = (inc.status || 'open').toLowerCase();
      incSummary[st] = (incSummary[st] || 0) + 1;

      if (!inc.assigned_to) {
        incSummary.unassigned++;
      }

      const pr = (inc.priority || 'medium').toLowerCase();
      incSummary.byPriority[pr] = (incSummary.byPriority[pr] || 0) + 1;

      if (['resolved', 'closed'].includes(st) && inc.resolved_at && inc.created_at) {
        const durMin = (new Date(inc.resolved_at) - new Date(inc.created_at)) / (1000 * 60);
        if (durMin >= 0) {
          totalDurationMinutes += durMin;
          resolvedCount++;
        }
      }
    });

    const avgMinutes = resolvedCount > 0 ? Math.round(totalDurationMinutes / resolvedCount) : 0;
    const avgHours = resolvedCount > 0 ? Number((avgMinutes / 60).toFixed(2)) : 0;

    const rules = memoryStore.detection_rules.map(dr => {
      const matchCount = memoryStore.findings.filter(f => f.rule_id === dr.rule_id).length;
      return {
        rule_id: dr.rule_id,
        rule_name: dr.rule_name,
        category: dr.category,
        severity: dr.severity,
        match_count: matchCount
      };
    });

    return {
      totalCompletedScans,
      totalFindings,
      findingsBySeverity,
      findingsByCategory,
      scans: scansMap,
      findingsByStatus,
      incidents: incSummary,
      mttr: {
        avgHours,
        avgMinutes,
        resolvedCases: resolvedCount
      },
      rules
    };
  };

  if (process.env.NODE_ENV === 'test') {
    return computeMetrics();
  }

  return cacheService.wrap('analytics:dashboard', computeMetrics, 5);
}

export default {
  listFindings,
  getFindingById,
  getDashboardMetrics
};
