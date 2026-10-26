-- ==============================================================================
-- LeakLens — Comprehensive Analytical & Operational SQL Queries
-- Microsoft SQL Server / Azure SQL Database
-- Designed for DP-900 Data Services, Power BI DirectQuery, and RDBMS Validation
-- ==============================================================================

-- ==============================================================================
-- QUERY 1: Deep Join across Users, Scan Jobs, Files, and Findings
-- Use Case: Security Analyst views detailed evidence chain for a specific scan.
-- Performance: Utilizes PK_scan_jobs, IX_files_scan_id, and IX_findings_file_id.
-- ==============================================================================
DECLARE @TargetScanId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000001';

SELECT 
    sj.scan_id,
    sj.status AS scan_status,
    u.display_name AS initiated_by_name,
    u.email AS initiated_by_email,
    fl.file_id,
    fl.original_filename,
    fl.blob_path,
    fl.content_hash,
    fl.file_size_bytes,
    f.finding_id,
    dr.rule_name,
    dr.category AS secret_category,
    f.severity AS finding_severity,
    f.status AS finding_status,
    f.location_reference,
    f.masked_excerpt,
    f.detected_at
FROM leaklens.scan_jobs sj
INNER JOIN leaklens.users u 
    ON sj.created_by = u.user_id
INNER JOIN leaklens.files fl 
    ON sj.scan_id = fl.scan_id
INNER JOIN leaklens.findings f 
    ON fl.file_id = f.file_id
INNER JOIN leaklens.detection_rules dr 
    ON f.rule_id = dr.rule_id
WHERE sj.scan_id = @TargetScanId
ORDER BY 
    CASE f.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
    END ASC,
    f.detected_at DESC;

-- ==============================================================================
-- QUERY 2: Filter Active Exposure Findings by Severity and Status
-- Use Case: Triage Queue filtering for unaddressed High/Critical secrets.
-- Performance: Supported by compound index IX_findings_severity_status with INCLUDE columns.
-- ==============================================================================
DECLARE @SeverityFilter NVARCHAR(16) = 'critical';
DECLARE @StatusFilter NVARCHAR(32) = 'detected';
DECLARE @PageOffset INT = 0;
DECLARE @PageLimit INT = 50;

SELECT 
    f.finding_id,
    f.severity,
    f.status,
    f.location_reference,
    f.masked_excerpt,
    f.detected_at,
    dr.rule_name,
    dr.category,
    fl.original_filename,
    fl.content_hash
FROM leaklens.findings f
INNER JOIN leaklens.detection_rules dr 
    ON f.rule_id = dr.rule_id
INNER JOIN leaklens.files fl 
    ON f.file_id = fl.file_id
WHERE f.severity = @SeverityFilter
  AND f.status = @StatusFilter
ORDER BY f.detected_at DESC
OFFSET @PageOffset ROWS
FETCH NEXT @PageLimit ROWS ONLY;

-- ==============================================================================
-- QUERY 3: Incident Assignment and Triage Status Retrieval
-- Use Case: Incident response queue showing open tickets and assigned security engineers.
-- Performance: Uses filtered index IX_incidents_assigned_to and IX_incidents_status_priority.
-- ==============================================================================
DECLARE @AnalystUserId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000002';
DECLARE @IncidentStatus NVARCHAR(32) = 'in_progress';

SELECT 
    inc.incident_id,
    inc.title,
    inc.status AS incident_status,
    inc.priority,
    inc.created_at,
    inc.updated_at,
    assigned_user.display_name AS assigned_analyst_name,
    assigned_user.email AS assigned_analyst_email,
    creator_user.display_name AS reported_by_name,
    COUNT(inf.finding_id) AS total_linked_findings,
    SUM(CASE WHEN f.severity = 'critical' THEN 1 ELSE 0 END) AS critical_findings_count,
    SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END) AS high_findings_count
FROM leaklens.incidents inc
LEFT JOIN leaklens.users assigned_user 
    ON inc.assigned_to = assigned_user.user_id
INNER JOIN leaklens.users creator_user 
    ON inc.created_by = creator_user.user_id
LEFT JOIN leaklens.incident_findings inf 
    ON inc.incident_id = inf.incident_id
LEFT JOIN leaklens.findings f 
    ON inf.finding_id = f.finding_id
WHERE (@AnalystUserId IS NULL OR inc.assigned_to = @AnalystUserId)
  AND (@IncidentStatus IS NULL OR inc.status = @IncidentStatus)
GROUP BY 
    inc.incident_id,
    inc.title,
    inc.status,
    inc.priority,
    inc.created_at,
    inc.updated_at,
    assigned_user.display_name,
    assigned_user.email,
    creator_user.display_name
ORDER BY 
    CASE inc.priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
    END ASC,
    inc.created_at DESC;

-- ==============================================================================
-- QUERY 4: Remediation History Audit per Incident
-- Use Case: Post-incident review showing actions taken, rotation notes, and timestamps.
-- Performance: Uses IX_remediation_actions_incident_id covering action_type and user_id.
-- ==============================================================================
DECLARE @TargetIncidentId UNIQUEIDENTIFIER = '00000000-0000-0000-0000-000000000003';

SELECT 
    ra.action_id,
    ra.incident_id,
    ra.action_type,
    ra.notes,
    ra.created_at AS action_timestamp,
    u.display_name AS performed_by_user,
    u.role AS user_role
FROM leaklens.remediation_actions ra
INNER JOIN leaklens.users u 
    ON ra.user_id = u.user_id
WHERE ra.incident_id = @TargetIncidentId
ORDER BY ra.created_at ASC;

-- ==============================================================================
-- QUERY 5: Aggregate Detection Counts by Severity and Rule Category
-- Use Case: Executive security posture summary widget on frontend dashboard.
-- Performance: Evaluated against pre-indexed findings without multi-table row multiplication.
-- ==============================================================================
SELECT 
    dr.category,
    f.severity,
    COUNT(f.finding_id) AS detection_count,
    COUNT(DISTINCT f.file_id) AS distinct_files_impacted,
    MIN(f.detected_at) AS first_observed_at,
    MAX(f.detected_at) AS most_recent_observed_at
FROM leaklens.findings f
INNER JOIN leaklens.detection_rules dr 
    ON f.rule_id = dr.rule_id
GROUP BY 
    dr.category,
    f.severity
ORDER BY 
    dr.category ASC,
    CASE f.severity
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        WHEN 'low' THEN 4
        ELSE 5
    END ASC;

-- ==============================================================================
-- QUERY 6: Mean Time to Remediate (MTTR) Analysis by Priority Tier
-- Use Case: SLA compliance tracking and SOC response duration metrics.
-- ==============================================================================
SELECT 
    priority,
    COUNT(incident_id) AS total_resolved_cases,
    AVG(DATEDIFF(MINUTE, created_at, resolved_at)) AS avg_resolution_minutes,
    AVG(DATEDIFF(SECOND, created_at, resolved_at) / 3600.0) AS avg_resolution_hours,
    MIN(DATEDIFF(MINUTE, created_at, resolved_at)) AS min_resolution_minutes,
    MAX(DATEDIFF(MINUTE, created_at, resolved_at)) AS max_resolution_minutes
FROM leaklens.incidents
WHERE status IN ('resolved', 'closed')
  AND resolved_at IS NOT NULL
GROUP BY priority
ORDER BY 
    CASE priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'medium' THEN 3
        ELSE 4
    END ASC;

-- ==============================================================================
-- QUERY 7: Temporal Detection Trends (Daily Aggregations)
-- Use Case: Trend line chart for Power BI Page 1 (Executive Overview).
-- ==============================================================================
SELECT 
    CAST(f.detected_at AS DATE) AS detection_date,
    dr.category,
    COUNT(f.finding_id) AS total_detections,
    SUM(CASE WHEN f.severity = 'critical' THEN 1 ELSE 0 END) AS critical_count,
    SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END) AS high_count,
    SUM(CASE WHEN f.severity = 'medium' THEN 1 ELSE 0 END) AS medium_count,
    SUM(CASE WHEN f.severity = 'low' THEN 1 ELSE 0 END) AS low_count
FROM leaklens.findings f
INNER JOIN leaklens.detection_rules dr 
    ON f.rule_id = dr.rule_id
GROUP BY 
    CAST(f.detected_at AS DATE),
    dr.category
ORDER BY 
    detection_date DESC,
    dr.category ASC;

-- ==============================================================================
-- QUERY 8: Power BI Page 2 (Detection Analysis) - Rule-Level Effectiveness
-- Use Case: Evaluates detection rule match frequencies vs false-positive suppressions.
-- ==============================================================================
SELECT 
    dr.rule_name,
    dr.category,
    dr.severity,
    COUNT(f.finding_id) AS total_matches,
    SUM(CASE WHEN f.status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed_exposures,
    SUM(CASE WHEN f.status = 'remediated' THEN 1 ELSE 0 END) AS remediated_exposures,
    SUM(CASE WHEN f.status = 'suppressed' THEN 1 ELSE 0 END) AS suppressed_false_positives,
    CASE 
        WHEN COUNT(f.finding_id) > 0 
        THEN (CAST(SUM(CASE WHEN f.status = 'remediated' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(f.finding_id)) * 100.0 
        ELSE 0 
    END AS remediation_rate_pct
FROM leaklens.detection_rules dr
LEFT JOIN leaklens.findings f 
    ON dr.rule_id = f.rule_id
GROUP BY 
    dr.rule_name,
    dr.category,
    dr.severity
ORDER BY total_matches DESC;

-- ==============================================================================
-- QUERY 9: Power BI Page 3 (Incident Response) - Analyst Caseload & Open Tickets
-- Use Case: Workload distribution and unassigned incident identification.
-- ==============================================================================
SELECT 
    ISNULL(u.display_name, '[UNASSIGNED]') AS analyst_name,
    COUNT(inc.incident_id) AS total_assigned_cases,
    SUM(CASE WHEN inc.status = 'open' THEN 1 ELSE 0 END) AS open_cases,
    SUM(CASE WHEN inc.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_cases,
    SUM(CASE WHEN inc.status = 'pending_verification' THEN 1 ELSE 0 END) AS pending_verification_cases,
    SUM(CASE WHEN inc.status = 'resolved' THEN 1 ELSE 0 END) AS resolved_cases,
    SUM(CASE WHEN inc.priority = 'critical' AND inc.status NOT IN ('resolved', 'closed') THEN 1 ELSE 0 END) AS active_critical_cases
FROM leaklens.incidents inc
LEFT JOIN leaklens.users u 
    ON inc.assigned_to = u.user_id
GROUP BY u.display_name
ORDER BY active_critical_cases DESC, total_assigned_cases DESC;

-- ==============================================================================
-- QUERY 10: Power BI Page 4 (Data Quality & Operational Health)
-- Use Case: Evaluates pipeline success rates, error frequencies, and scanned volume.
-- ==============================================================================
SELECT 
    sj.status AS pipeline_status,
    COUNT(sj.scan_id) AS total_scans,
    COUNT(DISTINCT fl.file_id) AS total_files,
    SUM(fl.file_size_bytes) / 1048576.0 AS total_volume_mb,
    AVG(DATEDIFF(MILLISECOND, sj.started_at, sj.completed_at)) / 1000.0 AS avg_scan_duration_sec,
    sj.error_code
FROM leaklens.scan_jobs sj
LEFT JOIN leaklens.files fl 
    ON sj.scan_id = fl.scan_id
GROUP BY 
    sj.status,
    sj.error_code
ORDER BY total_scans DESC;
