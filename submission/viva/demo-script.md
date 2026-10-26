# LeakLens — 10-Minute Academic Viva Live Demonstration Script

This runbook provides a time-stamped, step-by-step oral script and demonstration choreography for a 10-minute academic viva presentation.

---

## Timing Breakdown Overview

| Segment | Topic | Target Time | Cumulative |
| :--- | :--- | :--- | :--- |
| **Part 1** | Problem Statement & Architecture | 1 min 15 sec | 01:15 |
| **Part 2** | Authentication, JWT & RBAC Enforcement | 1 min 00 sec | 02:15 |
| **Part 3** | File Upload, Parsing & In-Memory Scanning | 1 min 15 sec | 03:30 |
| **Part 4** | In-Memory Masking & Normalized Findings Persistence | 1 min 15 sec | 04:45 |
| **Part 5** | Incident Management, Assignment & Remediation | 1 min 30 sec | 06:15 |
| **Part 6** | RDBMS Deep Dive: 3NF Schema & Atomic Stored Procedure | 1 min 30 sec | 07:45 |
| **Part 7** | DP-900 Data Services & Power BI Real-Time Analytics | 1 min 15 sec | 09:00 |
| **Part 8** | Cloud Security Controls, STRIDE & Limitations | 0 min 45 sec | 09:45 |
| **Part 9** | Conclusion & Defense Wrap-up | 0 min 15 sec | 10:00 |

---

## Part 1: Problem Statement & Architecture (00:00 – 01:15)

### Spoken Script:
> "Good morning, respected examiners. Today I present **LeakLens: Authorized Data Exposure Detection & Response**.
> 
> In modern software development, diagnostic logs, database exports, and configuration files routinely circulate between teams and external vendors. A major security failure occurs when developers unintentionally leave active API keys, database credentials, or private keys inside these files.
> 
> LeakLens solves this problem through an authorized defensive pipeline. Rather than acting as an invasive endpoint agent, it provides a secure pre-flight verification system where analysts submit candidate diagnostics.
> 
> Architecturally, LeakLens is designed as a **Modular Monolith**: a React Single Page Application on the frontend communicating via REST APIs to a Node.js/Express application layer, backed by Microsoft Azure SQL Database, Azure Private Blob Storage, and Azure Key Vault. This modular design provides native transactional integrity for incident resolution while eliminating distributed microservice overhead."

---

## Part 2: Authentication & RBAC Enforcement (01:15 – 02:15)

### Demonstration Action:
1. Navigate to `http://localhost:5173/login`.
2. Sign in as `analyst@leaklens.local` / `AnalystSecure2026!`.
3. Open Developer Tools (Network tab) to show the secure JWT exchange.
4. Show role badge: `ANALYST`.

### Spoken Script:
> "Here on the authentication screen, passwords are never stored in plaintext; they are hashed server-side using **bcrypt** with a cost work factor of 10.
> 
> Upon authentication, the server issues a signed JSON Web Token containing identity and role claims. We enforce strict **Role-Based Access Control (RBAC)** across three personas: Admin, Security Analyst, and Compliance Auditor.
> 
> Notice that as an Analyst, I have full operational privileges to upload files, triage findings, and remediate incidents. If an Auditor logs in, all state-mutating endpoints immediately return HTTP 403 Forbidden, guaranteeing non-repudiation."

---

## Part 3: File Upload & In-Memory Scanning (02:15 – 03:30)

### Demonstration Action:
1. Navigate to **File Upload** (`/scans/upload`).
2. Select the synthetic test file: `tests/fixtures/synthetic-cloud-dump.txt`.
3. Click **Start Authorized Scan**.

### Spoken Script:
> "Now I will upload a diagnostic file containing simulated environment variables and log entries.
> 
> On the backend, `server/src/routes/scanRoutes.js` intercepts the multipart request using Multer in memory-storage mode. We enforce two strict defensive boundary checks:
> 1. A maximum file size ceiling of 10 megabytes to prevent Denial of Service buffer overflow attacks.
> 2. An explicit file extension whitelist permitting only `.txt`, `.json`, and `.csv`.
> 
> The raw buffer is streamed directly into our regex detection engine in volatile memory. Notice that the raw file is never persisted to unencrypted server disk space or local temporary directories."

---

## Part 4: In-Memory Masking & Findings Persistence (03:30 – 04:45)

### Demonstration Action:
1. View the newly generated findings on the **Findings Dashboard** (`/findings`).
2. Highlight the masked token (e.g., `ghp_***_4f92` and `AKIA***EXMP`).
3. Click on finding details to inspect line numbers and classification.

### Spoken Script:
> "The scan has detected two high-risk exposures: an AWS Access Key and a GitHub Personal Access Token.
> 
> Notice the **Masking Engine** (`maskingService.js`): raw secret strings are immediately redacted before database persistence. The first and last characters are preserved for cryptographic pattern verification, but the secret core is scrubbed.
> 
> If an attacker compromises our SQL database or intercepts application logs, zero usable plaintext credentials exist in storage. The finding is persisted into `leaklens.findings` in strict Third Normal Form, referencing the compiled rule definition in `leaklens.detection_rules`."

---

## Part 5: Incident Management & Remediation (04:45 – 06:15)

### Demonstration Action:
1. Select the AWS Access Key finding and click **Escalate to Incident**.
2. Assign the incident to `SecOps Team Alpha` with priority `High`.
3. Navigate to **Incidents** (`/incidents`), click the new incident, and log a remediation action: `Rotated IAM Access Key in AWS Console and invalidated previous keypair.`
4. Click **Resolve Incident**.

### Spoken Script:
> "Detecting exposure is only half the battle; defensive security requires structured remediation.
> 
> I have escalated this finding into an active Incident. Notice the many-to-many relationship tracked via `leaklens.incident_findings`.
> 
> I now record the corrective remediation action. When I click **Resolve Incident**, the backend invokes our transactional stored procedure: `sp_resolve_incident`. This enforces atomic state transitions: the incident moves to 'resolved', the timestamp is locked, and an audit entry is committed."

---

## Part 6: RDBMS Deep Dive & Stored Procedure Atomicity (06:15 – 07:45)

### Demonstration Action:
1. Switch to IDE/terminal showing `database/procedures.sql`.
2. Highlight `sp_resolve_incident` lines with `BEGIN TRANSACTION`, `version = version + 1`, and `THROW`.

### Spoken Script:
> "Let us examine the Relational Database layer.
> 
> The database schema consists of 9 fully normalized tables in 3NF. In `sp_resolve_incident`, we guarantee the **ACID** properties:
> - **Atomicity:** The incident status update, remediation insertion, and audit trail write are wrapped in a single database transaction. If the audit insert fails, all changes roll back immediately.
> - **Optimistic Concurrency Control:** We track a `version` integer on `leaklens.incidents`. If two analysts attempt to resolve the incident simultaneously, the second transaction detects a version mismatch (`@@ROWCOUNT = 0`) and rejects the conflict.
> - **Double-Counting Prevention:** In our analytical view `vw_exposure_analytics`, we utilize pre-aggregated Common Table Expressions (CTEs) so that joining findings with incident mappings never inflates aggregate sums."

---

## Part 7: DP-900 Data Services & Power BI Analytics (07:45 – 09:00)

### Demonstration Action:
1. Navigate to the **Analytics Dashboard** (`/analytics`) in LeakLens.
2. Highlight the MTTR metric scorecard (Mean Time to Remediate) and Severity Distribution bar chart.
3. Show the Power BI DirectQuery architectural schema and DAX formula definition.

### Spoken Script:
> "Moving to our DP-900 Azure Data integration:
> 
> LeakLens aligns with Microsoft's Three-Tier Data Classification:
> 1. **Unstructured Data:** Raw diagnostic uploads stored in Azure Private Blob Storage containers with SAS token authorization.
> 2. **Semi-Structured Data:** Detection signatures and JSON audit metadata.
> 3. **Structured Data:** The normalized relational schema in Azure SQL Database.
> 
> Power BI connects to Azure SQL via **DirectQuery** mode. DirectQuery offloads query execution directly to SQL Server views without caching raw sensitive metadata in local `.pbix` files. Our DAX measure dynamically calculates **Mean Time to Remediate (MTTR)** in hours."

---

## Part 8: Cloud Security, STRIDE & Limitations (09:00 – 09:45)

### Demonstration Action:
1. Navigate to **Forensic Audit Logs** (`/audit-logs`).
2. Show the immutable log of our previous upload, incident escalation, and resolution actions.

### Spoken Script:
> "For Cloud Security, we evaluated LeakLens against the **STRIDE** threat model:
> - Spoofing is mitigated via Bcrypt and signed JWTs.
> - Tampering is prevented via parameterized SQL queries and optimistic concurrency control.
> - Information Disclosure is prevented by in-memory masking and Private Azure Blob containers.
> - Repudiation is addressed by our immutable `leaklens.audit_logs` table.
> 
> **Documented Limitations:** Pattern detection relies on regular expressions. While highly effective for known token formats, it can produce false positives on high-entropy random GUIDs, which is why human analyst validation remains a core requirement."

---

## Part 9: Conclusion & Defense Wrap-up (09:45 – 10:00)

### Spoken Script:
> "In summary, LeakLens successfully demonstrates the synthesis of:
> 1. **System Design:** Scalable modular monolith architecture.
> 2. **RDBMS:** Normalized 3NF SQL schema with atomic transactions.
> 3. **DP-900:** Enterprise Azure data classification and DirectQuery analytics.
> 4. **Cloud Security:** Defense-in-depth masking, RBAC, and threat modeling.
> 
> Thank you, and I am now ready to answer any technical questions from the panel."

---

## Fallback Procedures (If Live Services Are Unavailable)

| Scenario | Symptom | Fallback Action |
| :--- | :--- | :--- |
| **Azure SQL Cloud Unreachable** | Connection timeout or firewall block | The backend automatically activates the in-memory transactional mock repository (`memoryStore.js`). All CRUD and metrics remain 100% functional for local demo. |
| **Port Conflict** | Port 3000/5173 occupied | Launch backend on alternate port via `PORT=3001 npm --prefix server start` and update `client/vite.config.js`. |
| **Auth Session Expired** | 401 Unauthorized in API | Click **Logout** and immediately re-authenticate using provisioned credentials `analyst@leaklens.local` / `AnalystSecure2026!`. |

---
*End of Demonstration Script.*
