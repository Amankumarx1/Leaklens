-- ==============================================================================
-- LeakLens — Representative Analytical & Operational Queries
-- Microsoft SQL Server / Azure SQL Database
-- Designed with Parameterized Inputs, Index Optimization & Execution Plan Notes
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
DECLARE @IncidentStatus NVARCHAR(32) = 'under_investigation';

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
