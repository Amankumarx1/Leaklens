-- ==============================================================================
-- LeakLens — Relational Reporting Views
-- Microsoft SQL Server / Azure SQL Database
-- View: vw_exposure_analytics
-- Purpose: Provides aggregated sensitive-data exposure metrics for dashboards
-- and future Power BI datasets without count duplication anomalies.
-- ==============================================================================

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
