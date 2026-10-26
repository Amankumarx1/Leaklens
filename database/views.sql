-- ==============================================================================
-- LeakLens — Relational Reporting Views for Power BI & Analytical Dashboards
-- Microsoft SQL Server / Azure SQL Database
-- Designed with Pre-Aggregated CTEs to eliminate row multiplication anomalies
-- across many-to-many junction tables.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. VIEW: vw_exposure_analytics
-- Purpose: Supplies findings-level exposure metrics grouped by category,
-- severity, finding status, and detection rule signature.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.vw_exposure_analytics', 'V') IS NOT NULL
BEGIN
    DROP VIEW leaklens.vw_exposure_analytics;
END
GO

CREATE VIEW leaklens.vw_exposure_analytics
AS
WITH FindingIncidentLink AS (
    -- Pre-aggregate incident link counts per finding to prevent row duplication
    -- when joining across the many-to-many incident_findings junction table.
    SELECT 
        finding_id,
        COUNT(incident_id) AS incident_count
    FROM leaklens.incident_findings
    GROUP BY finding_id
)
SELECT 
    dr.category,
    f.severity,
    f.status AS finding_status,
    dr.rule_name,
    COUNT(f.finding_id) AS total_findings,
    COUNT(DISTINCT f.file_id) AS unique_affected_files,
    COUNT(DISTINCT fl.scan_id) AS unique_scans_impacted,
    SUM(CASE WHEN fil.incident_count > 0 THEN 1 ELSE 0 END) AS findings_escalated_to_incidents,
    SUM(CASE WHEN fil.incident_count IS NULL OR fil.incident_count = 0 THEN 1 ELSE 0 END) AS findings_unassigned,
    MIN(f.detected_at) AS first_detected_at,
    MAX(f.detected_at) AS last_detected_at
FROM leaklens.findings f
INNER JOIN leaklens.detection_rules dr 
    ON f.rule_id = dr.rule_id
INNER JOIN leaklens.files fl 
    ON f.file_id = fl.file_id
LEFT JOIN FindingIncidentLink fil 
    ON f.finding_id = fil.finding_id
GROUP BY 
    dr.category,
    f.severity,
    f.status,
    dr.rule_name;
GO

-- ------------------------------------------------------------------------------
-- 2. VIEW: vw_incident_analytics
-- Purpose: Supplies incident containment metrics, priority distributions,
-- resolution status, assignee workloads, and MTTR duration metrics.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.vw_incident_analytics', 'V') IS NOT NULL
BEGIN
    DROP VIEW leaklens.vw_incident_analytics;
END
GO

CREATE VIEW leaklens.vw_incident_analytics
AS
WITH LinkedFindingsAgg AS (
    -- Pre-aggregate linked findings per incident to avoid cartesian inflation
    SELECT 
        incident_id,
        COUNT(finding_id) AS total_linked_findings
    FROM leaklens.incident_findings
    GROUP BY incident_id
),
ActionsAgg AS (
    -- Pre-aggregate remediation actions count per incident
    SELECT 
        incident_id,
        COUNT(action_id) AS total_actions_taken,
        SUM(CASE WHEN action_type = 'VERIFICATION' THEN 1 ELSE 0 END) AS verification_actions_count,
        SUM(CASE WHEN action_type = 'REOPEN' THEN 1 ELSE 0 END) AS reopen_actions_count
    FROM leaklens.remediation_actions
    GROUP BY incident_id
)
SELECT 
    inc.incident_id,
    inc.title,
    inc.status AS incident_status,
    inc.priority,
    CASE WHEN inc.assigned_to IS NOT NULL THEN 1 ELSE 0 END AS is_assigned,
    u_assigned.display_name AS assigned_analyst_name,
    u_creator.display_name AS creator_name,
    ISNULL(lfa.total_linked_findings, 0) AS total_linked_findings,
    ISNULL(act.total_actions_taken, 0) AS total_actions_taken,
    ISNULL(act.verification_actions_count, 0) AS verification_count,
    ISNULL(act.reopen_actions_count, 0) AS reopen_count,
    inc.created_at,
    inc.updated_at,
    inc.resolved_at,
    -- Calculate MTTR (Mean Time to Remediate) in hours where resolved_at is valid
    CASE 
        WHEN inc.resolved_at IS NOT NULL AND inc.resolved_at >= inc.created_at 
        THEN DATEDIFF(SECOND, inc.created_at, inc.resolved_at) / 3600.0
        ELSE NULL 
    END AS resolution_duration_hours
FROM leaklens.incidents inc
LEFT JOIN leaklens.users u_assigned 
    ON inc.assigned_to = u_assigned.user_id
INNER JOIN leaklens.users u_creator 
    ON inc.created_by = u_creator.user_id
LEFT JOIN LinkedFindingsAgg lfa 
    ON inc.incident_id = lfa.incident_id
LEFT JOIN ActionsAgg act 
    ON inc.incident_id = act.incident_id;
GO

-- ------------------------------------------------------------------------------
-- 3. VIEW: vw_operational_metrics
-- Purpose: System operations and scanning pipeline health for DP-900 reporting.
-- ------------------------------------------------------------------------------
IF OBJECT_ID('leaklens.vw_operational_metrics', 'V') IS NOT NULL
BEGIN
    DROP VIEW leaklens.vw_operational_metrics;
END
GO

CREATE VIEW leaklens.vw_operational_metrics
AS
SELECT 
    sj.status AS scan_status,
    COUNT(sj.scan_id) AS total_jobs,
    COUNT(DISTINCT fl.file_id) AS total_files_processed,
    SUM(ISNULL(fl.file_size_bytes, 0)) AS total_bytes_scanned,
    AVG(CASE 
        WHEN sj.completed_at IS NOT NULL AND sj.started_at IS NOT NULL 
        THEN DATEDIFF(MILLISECOND, sj.started_at, sj.completed_at)
        ELSE NULL 
    END) AS avg_scan_duration_ms,
    COUNT(DISTINCT sj.error_code) AS distinct_error_codes,
    MIN(sj.created_at) AS earliest_job_at,
    MAX(sj.created_at) AS latest_job_at
FROM leaklens.scan_jobs sj
LEFT JOIN leaklens.files fl 
    ON sj.scan_id = fl.scan_id
GROUP BY 
    sj.status;
GO
