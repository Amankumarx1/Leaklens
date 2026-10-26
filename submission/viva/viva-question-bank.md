# LeakLens — Comprehensive Academic Viva Question Bank

This document compiles a rigorous, defensible question-and-answer bank designed for academic examiners, technical viva panels, and industry auditors reviewing **LeakLens: Authorized Data Exposure Detection & Response**.

All answers cite actual codebase symbols, database schemas, API routes, and architectural decisions implemented in the repository.

---

## Table of Contents
1. [Category A: Project Overview & Core Philosophy](#category-a-project-overview--core-philosophy)
2. [Category B: System Design & Architecture](#category-b-system-design--architecture)
3. [Category C: Relational Database Management Systems (RDBMS)](#category-c-relational-database-management-systems-rdbms)
4. [Category D: DP-900 & Azure Data Engineering](#category-d-dp-900--azure-data-engineering)
5. [Category E: Cloud Security, Cryptography & Compliance](#category-e-cloud-security-cryptography--compliance)
6. [Category F: Deep Implementation & Source Code Tracing](#category-f-deep-implementation--source-code-tracing)

---

## Category A: Project Overview & Core Philosophy

### Q1: What specific security problem does LeakLens solve, and what is its threat model?
**Answer:**  
Modern software organizations routinely exchange diagnostic logs, database exports, configuration dumps, and CSV telemetry with external vendors, support engineers, or cross-functional teams. These unstructured and semi-structured files frequently contain accidentally leaked credentials (such as AWS access keys, GitHub tokens, Slack Webhooks, and PEM private keys).

LeakLens acts as a defensive pre-flight and incident response platform. Authorized analysts upload candidate files; LeakLens conducts in-memory pattern analysis, automatically redacts raw secrets using deterministic masks, persists normalized findings, coordinates incident assignment, enforces remediation workflows, and logs immutable audit trails for compliance.

### Q2: Why is LeakLens described as an *authorized* data exposure detection platform rather than a DLP or antivirus solution?
**Answer:**  
LeakLens is not an OS kernel driver, network packet sniffer, or transparent proxy (which characterize commercial endpoint DLP). Instead, it operates at the application boundary for intentional, authorized file processing. Analysts proactively submit diagnostic dumps before outbound transmission. Furthermore, LeakLens deliberately decouples pattern detection from full breach claims: pattern matches indicate *exposure risk* requiring analyst triage, not guaranteed operational compromise.

---

## Category B: System Design & Architecture

### Q3: Why did you architect LeakLens as a Modular Monolith instead of Microservices?
**Answer:**  
1. **Transaction Integrity:** Incident resolution requires atomic synchronization between `leaklens.incidents`, `leaklens.remediation_actions`, and `leaklens.audit_logs`. A modular monolith on SQL Server enables native ACID two-phase transactions without distributed sagas or eventual consistency anomalies.
2. **Operational Simplicity & Latency:** Avoids network serialization overhead and complex gRPC/HTTP meshes for internal service communication.
3. **Domain Encapsulation:** Code is cleanly partitioned into domain layers (`controllers/`, `services/`, `repositories/`, `middleware/`, `parsers/`). If scaling demands it in the future, these modules can be decomposed into independent containerized microservices.

### Q4: How does LeakLens handle high-volume file uploads without memory exhaustion?
**Answer:**  
In `server/src/routes/scanRoutes.js`, Multer is configured with a strict 10MB file size ceiling (`limits: { fileSize: 10 * 1024 * 1024 }`) and an explicit extension whitelist (`.txt`, `.json`, `.csv`). The scanner streams or buffers chunks sequentially in memory. In-memory processing prevents disk write I/O bottlenecks and avoids writing unmasked secrets to server swap or temporary disk partitions.

### Q5: How is optimism/concurrency handled during concurrent incident updates?
**Answer:**  
LeakLens uses **Optimistic Concurrency Control (OCC)**. The `leaklens.incidents` table maintains an integer `version` column. In `database/procedures.sql` (`sp_resolve_incident`), the update statement executes:
```sql
UPDATE leaklens.incidents
SET status = 'resolved', version = version + 1, updated_at = SYSUTCDATETIME()
WHERE id = @incident_id AND version = @expected_version;
```
If `@@ROWCOUNT = 0`, another analyst has modified the incident concurrently. The transaction immediately rolls back and returns an error (`409 Conflict`), preventing lost-update anomalies.

---

## Category C: Relational Database Management Systems (RDBMS)

### Q6: Walk us through the normalization of your database schema. Is it in 3NF?
**Answer:**  
Yes, the schema strictly adheres to **Third Normal Form (3NF)**:
- **1NF:** All attributes are atomic (no repeating groups, comma-separated lists, or nested records).
- **2NF:** Every non-key attribute is fully functionally dependent on the primary key (no partial key dependencies).
- **3NF:** No transitive dependencies exist. For example, `findings` references `detection_rules` via foreign key `rule_id` rather than redundantly copying rule descriptions, severity, or regex patterns into the `findings` table.
The 9 normalized tables are: `users`, `audit_logs`, `detection_rules`, `scans`, `findings`, `incidents`, `incident_findings`, `remediation_actions`, and `refresh_tokens`.

### Q7: How does `sp_resolve_incident` guarantee ACID properties?
**Answer:**  
In `database/procedures.sql`:
- **Atomicity:** The entire operation is enclosed in `BEGIN TRY ... BEGIN TRANSACTION ... COMMIT TRANSACTION END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION; THROW; END CATCH`. If the audit log insert fails, the incident status update and remediation insert are completely rolled back.
- **Consistency:** Foreign key constraints (`FK_remediation_incident`, `FK_audit_user`) and check constraints (`CHK_incident_status`) are enforced by the database engine.
- **Isolation:** Executed under `READ COMMITTED` (with table row locks) ensuring uncommitted changes are invisible to concurrent queries.
- **Durability:** Once committed, SQL Server's write-ahead log (WAL) guarantees transactions survive host crashes or restarts.

### Q8: How did you solve the "Row Duplication / Double Counting" problem in your analytics views?
**Answer:**  
In `database/views.sql`, `vw_exposure_analytics` aggregates statistics across scans, findings, and incidents. A naive join between `findings` and `incident_findings` causes a Cartesian product whenever multiple findings map to one incident or vice versa.  
We solved this by pre-aggregating metrics inside **Common Table Expressions (CTEs)**:
```sql
WITH FindingCounts AS (
    SELECT scan_id, COUNT(*) AS total_findings,
           SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical_count
    FROM leaklens.findings GROUP BY scan_id
)
SELECT s.id, s.file_name, ISNULL(fc.total_findings, 0) ...
FROM leaklens.scans s
LEFT JOIN FindingCounts fc ON s.id = fc.scan_id;
```
This guarantees that each scan record is joined exactly once, eliminating duplicate row inflation.

---

## Category D: DP-900 & Azure Data Engineering

### Q9: How does LeakLens categorize data according to DP-900 data classification guidelines?
**Answer:**  
LeakLens categorizes data into three DP-900 classifications:
1. **Unstructured Data:** Raw diagnostic uploads, log streams, text dumps, and CSV files. Stored securely in private **Azure Blob Storage** containers with TLS 1.3 encryption-in-transit and AES-256 server-side encryption-at-rest.
2. **Semi-Structured Data:** Ingested JSON configuration files, detection rule signatures, and unstructured audit metadata blobs (`JSON/NVARCHAR(MAX)`).
3. **Structured Relational Data:** Normalized business entities, relational mappings, transactional states, and user records stored in **Azure SQL Database**.

### Q10: How does Power BI connect to LeakLens, and why was DirectQuery chosen over Import mode?
**Answer:**  
Power BI connects to Azure SQL Database using **DirectQuery** mode pointing directly to the SQL views (`vw_exposure_analytics`, `vw_incident_analytics`).  
**Why DirectQuery?**
- **Real-Time Forensic Visibility:** Incidents and newly detected critical exposures are reflected on executive dashboards within seconds, without waiting for hourly scheduled dataset refreshes.
- **Zero Local Data Duplication:** DirectQuery pushes SQL query evaluation down to the database engine. Sensitive finding metadata is never imported or cached in unencrypted `.pbix` local files.

### Q11: What is Mean Time to Remediate (MTTR), and how is it calculated in SQL and DAX?
**Answer:**  
MTTR measures the operational efficiency of the security response team by calculating the average elapsed time from incident creation to final resolution.  
In T-SQL (`vw_incident_analytics`):
```sql
AVG(CAST(DATEDIFF(MINUTE, i.created_at, i.resolved_at) AS FLOAT)) / 60.0 AS avg_mttr_hours
```
In Power BI DAX:
```dax
MTTR_Hours = 
AVERAGEX(
    FILTER('Incidents', 'Incidents'[status] = "resolved" && NOT(ISBLANK('Incidents'[resolved_at]))),
    DATEDIFF('Incidents'[created_at], 'Incidents'[resolved_at], MINUTE) / 60.0
)
```

---

## Category E: Cloud Security, Cryptography & Compliance

### Q12: How are passwords stored and verified in LeakLens?
**Answer:**  
In `server/src/repositories/userRepository.js`, passwords are hashed using **bcrypt** with a cost work factor of 10 (`bcrypt.hash(password, 10)`). Bcrypt automatically generates a cryptographically secure 128-bit salt per user and incorporates key-stretching resistant to GPU/ASIC rainbow table attacks. Plaintext passwords are never logged, printed, or returned in API responses.

### Q13: How does LeakLens protect against Broken Object Level Authorization (BOLA / IDOR)?
**Answer:**  
In `server/src/controllers/incidentController.js` and `findingController.js`, API handlers do not rely solely on the presence of a valid JWT. They execute resource-level RBAC checks:
1. The user's role is extracted directly from the verified server-side JWT signature (`req.user.role`).
2. Analysts (`analyst`) can inspect findings, create incidents, and attach remediation actions.
3. System Auditors (`auditor`) have read-only access to findings and audit logs, but mutations (`POST`, `PATCH`, `DELETE`) return `403 Forbidden`.
4. Role claims passed in the HTTP request payload are explicitly ignored.

### Q14: How does LeakLens prevent secret leakage in application logs?
**Answer:**  
1. **In-Memory Masking Before Persistence:** When `server/src/services/maskingService.js` detects a token (e.g., `AKIA1234567890EXAMPLE`), it redacts the middle 70% (`AKIA***MPLE`). The raw token is immediately discarded from memory.
2. **Log Sanitization:** Application logging utilities only log file metadata (e.g., `file_name`, `file_size`, `rule_id`, `masked_preview`). No raw buffer dumps or raw match substrings are ever passed to `console.log` or structured logger transports.

---

## Category F: Deep Implementation & Source Code Tracing

### Q15: Trace the complete path of a file upload from the React UI to SQL persistence.
**Answer:**  
1. **Frontend:** User selects a file on `client/src/pages/ScanUploadPage.jsx`. An `axios` multipart/form-data POST is dispatched to `/api/scans/upload` with the JWT in the `Authorization: Bearer <token>` header.
2. **Route Middleware:** `server/src/routes/scanRoutes.js` executes `authMiddleware.verifyToken` to validate the JWT signature, then runs Multer memory-storage upload middleware enforcing the 10MB limit and `.txt/.json/.csv` extension filter.
3. **Controller:** `scanController.handleUpload` extracts `req.file.buffer` and calls `detectionService.scanBuffer(buffer, fileName)`.
4. **Detection & Masking:** `server/src/services/detectionService.js` iterates through compiled regex rules from `ruleRepository`. For each match, `maskingService.maskSnippet` generates the redacted excerpt and calculates the line number.
5. **Persistence:** `findingRepository.createScanWithFindings` opens a SQL transaction (or memoryStore batch), inserting the parent `leaklens.scans` record followed by multiple child `leaklens.findings` rows.
6. **Audit Trail:** An audit event (`scan_created`) is inserted into `leaklens.audit_logs`.
7. **Response:** HTTP 201 Created is returned to React with masked findings, which renders the results on `client/src/pages/FindingsDashboardPage.jsx`.

### Q16: How does the application handle Azure SQL or Blob Storage outages?
**Answer:**  
LeakLens features **Dual-Mode Architectural Resilience**:
- In `server/src/config/azure.js` and `server/src/repositories/findingRepository.js`, connection health checks test external database/blob connectivity.
- If `DB_HOST` or Azure Managed Identity endpoints are unavailable (or in local offline testing), the repository layer seamlessly transitions to an in-memory transactional mock store (`memoryStore.js`).
- Readiness probes (`GET /health/ready`) report dependency status (`database: "connected" | "degraded"`), allowing App Service orchestrators or load balancers to route traffic safely.

---

*End of Comprehensive Viva Question Bank.*
