# Relational Database Management Systems (RDBMS) — Viva Defense Guide

## 1. Schema Design & Normalization Overview

LeakLens uses a relational database design implemented in **Microsoft SQL Server 2022 / Azure SQL Database**. The schema consists of **9 normalized tables** residing within the dedicated `leaklens` database schema, guaranteeing Third Normal Form (3NF) compliance and referential integrity.

---

## 2. Third Normal Form (3NF) Justification & Anomaly Prevention

A relational schema is in **Third Normal Form (3NF)** if and only if:
1. It is in Second Normal Form (2NF) — all non-key attributes are fully functionally dependent on the entire primary key (no partial dependencies).
2. It contains zero **transitive dependencies** — no non-key attribute is dependent on another non-key attribute ($X \to Y$ where neither $X$ is a superkey nor $Y$ is a prime attribute).

### Normalization Defense by Entity:
1. **Separation of Scans and Files (`scan_jobs` $\to$ `files`):**
   - *Anti-pattern avoided:* Storing file attributes (`original_filename`, `content_hash`, `file_size_bytes`) directly in `scan_jobs`.
   - *Why 3NF:* A scan job can inspect multiple files. Storing file properties on `scan_jobs` would cause update and deletion anomalies. In LeakLens, `files` has its own surrogate key `file_id` and foreign key `scan_id`.
2. **Separation of Detection Signatures (`detection_rules` $\to$ `findings`):**
   - *Anti-pattern avoided:* Embedding rule descriptions, categories, and signature patterns in every finding row.
   - *Why 3NF:* If a rule description were stored in `findings`, updating the description would require modifying thousands of finding records (Update Anomaly). In LeakLens, `findings.rule_id` references `detection_rules.rule_id`.
3. **Many-to-Many Incident Grouping (`incidents` $\leftrightarrow$ `findings` via `incident_findings`):**
   - *Anti-pattern avoided:* Adding an `incident_id` nullable column to `findings`.
   - *Why 3NF:* An incident can encompass multiple related findings, and in complex scenarios, a finding may be linked to multiple investigations. The junction table `incident_findings` cleanly models this $M:N$ relationship without null pointer bloat.

---

## 3. Table Catalog & Constraint Enforcement

| Table Name | Primary Key | Foreign Keys | Key Constraints & Rules |
| :--- | :--- | :--- | :--- |
| `users` | `user_id` (UUID) | None | `email` UNIQUE, `CHECK (LIKE '%_@__%.__%')`, `CHECK (role IN ('ADMIN', 'ANALYST', 'COMPLIANCE_REVIEWER'))`. |
| `scan_jobs` | `scan_id` (UUID) | `created_by` $\to$ `users(user_id)` | `CHECK (status IN ('pending', 'queued', 'in_progress', 'completed', 'failed', 'cancelled'))`, `CHECK (completed_at >= started_at)`. |
| `files` | `file_id` (UUID) | `scan_id` $\to$ `scan_jobs(scan_id) ON DELETE CASCADE` | `CHECK (LEN(content_hash) = 64)` (SHA-256), `CHECK (file_size_bytes >= 0)`. |
| `detection_rules` | `rule_id` (UUID) | None | `rule_name` UNIQUE, `CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info'))`. |
| `findings` | `finding_id` (UUID)| `file_id` $\to$ `files`, `rule_id` $\to$ `detection_rules` | `CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info'))`, `CHECK (status IN ('detected', 'confirmed', 'remediated', 'suppressed'))`. |
| `incidents` | `incident_id` (UUID)| `assigned_to` $\to$ `users`, `created_by` $\to$ `users` | `CHECK (status IN ('open', 'in_progress', 'pending_verification', 'resolved', 'closed'))`, `CHECK (priority IN ('critical', 'high', 'medium', 'low'))`, `version INT DEFAULT 1`. |
| `incident_findings`| `(incident_id, finding_id)` | Compound PK referencing `incidents` & `findings` | Enforces non-duplicate associations via compound clustered primary key. |
| `remediation_actions`| `action_id` (UUID)| `incident_id` $\to$ `incidents`, `user_id` $\to$ `users` | `CHECK (action_type IN ('ASSIGNMENT', 'INVESTIGATION_NOTE', 'STATUS_CHANGE', 'REMEDIATION', 'VERIFICATION', 'RESOLUTION', 'REOPEN'))`. |
| `audit_logs` | `audit_id` (UUID) | `user_id` $\to$ `users` | Append-only ledger; `metadata_json` stores contextual JSON event payloads. |

---

## 4. Stored Procedure `leaklens.sp_resolve_incident` & Transactional Atomicity

### The Problem of Partial Updates:
Resolving a security incident requires mutating multiple tables simultaneously:
1. Update incident status to `resolved` and record `resolved_at` UTC timestamp.
2. Update all associated findings in `leaklens.findings` to `remediated`.
3. Insert a remediation history action of type `RESOLUTION`.
4. Insert a security audit log event `INCIDENT_RESOLVED`.

If an unhandled server crash occurs between step 2 and step 4, the database enters an **inconsistent state**: findings appear remediated, but no audit log or resolution history exists.

### The Stored Procedure Solution:
`leaklens.sp_resolve_incident` wraps all four operations inside an atomic transaction:

```sql
CREATE PROCEDURE leaklens.sp_resolve_incident
    @incident_id UNIQUEIDENTIFIER,
    @resolved_by UNIQUEIDENTIFIER,
    @resolution_summary NVARCHAR(1024),
    @expected_version INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON; -- Automatically rollback on runtime exceptions

    BEGIN TRY
        BEGIN TRANSACTION;

        -- 1. Validate Optimistic Concurrency Token
        DECLARE @CurrentVersion INT, @CurrentStatus NVARCHAR(32);
        SELECT @CurrentVersion = version, @CurrentStatus = status
        FROM leaklens.incidents WITH (UPDLOCK, ROWLOCK)
        WHERE incident_id = @incident_id;

        IF @CurrentVersion IS NULL
            THROW 50001, 'Incident not found.', 1;

        IF @CurrentVersion <> @expected_version
            THROW 50002, 'Concurrency conflict: record has been modified by another analyst.', 1;

        -- 2. Update Incident Record
        UPDATE leaklens.incidents
        SET status = 'resolved',
            resolution_summary = @resolution_summary,
            resolved_at = SYSUTCDATETIME(),
            updated_at = SYSUTCDATETIME(),
            version = version + 1
        WHERE incident_id = @incident_id;

        -- 3. Cascade Status to Associated Findings
        UPDATE f
        SET f.status = 'remediated'
        FROM leaklens.findings f
        INNER JOIN leaklens.incident_findings inf ON f.finding_id = inf.finding_id
        WHERE inf.incident_id = @incident_id;

        -- 4. Record Remediation History Action
        INSERT INTO leaklens.remediation_actions (incident_id, user_id, action_type, notes)
        VALUES (@incident_id, @resolved_by, 'RESOLUTION', @resolution_summary);

        -- 5. Record Immutable Audit Event
        INSERT INTO leaklens.audit_logs (user_id, event_type, entity_type, entity_id, metadata_json)
        VALUES (@resolved_by, 'INCIDENT_RESOLVED', 'incident', @incident_id, ...);

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
```

---

## 5. Elimination of Join Row Duplication in Reporting Views

A classic flaw in naive database reporting is joining a parent table (`findings`) directly to a many-to-many junction table (`incident_findings`). If a finding is linked to 3 incidents, a `COUNT(finding_id)` returns 3 instead of 1 (Cartesian row duplication).

### How LeakLens Solves This:
In `leaklens.vw_exposure_analytics`, a **Common Table Expression (CTE)** pre-aggregates junction counts before the join:

```sql
WITH FindingIncidentLink AS (
    SELECT 
        finding_id,
        COUNT(incident_id) AS incident_count
    FROM leaklens.incident_findings
    GROUP BY finding_id
)
SELECT 
    dr.category,
    f.severity,
    COUNT(f.finding_id) AS total_findings,
    SUM(CASE WHEN fil.incident_count > 0 THEN 1 ELSE 0 END) AS findings_escalated_to_incidents
FROM leaklens.findings f
LEFT JOIN FindingIncidentLink fil ON f.finding_id = fil.finding_id
...
```
This guarantees that each finding contributes exactly 1 to the aggregate sum, maintaining mathematical accuracy in Power BI dashboards.

---

## 6. Indexing Strategy & Execution Plan Optimization

1. `IX_files_scan_id`: Accelerates cascade deletions and scan-to-file retrieval.
2. `IX_findings_file_id`: Accelerates evidence retrieval for a given file.
3. `IX_findings_severity_status` (Compound Covered Index):
   `CREATE NONCLUSTERED INDEX IX_findings_severity_status ON leaklens.findings (severity, status) INCLUDE (masked_excerpt, detected_at);`
   - *Impact:* Allows the findings triage queue (`WHERE severity = 'critical' AND status = 'detected'`) to be satisfied via an **Index Seek** without requiring costly clustered key lookups.
4. `IX_incidents_status_priority`: Speeds up SOC dashboard queue sorting and active case filtering.
