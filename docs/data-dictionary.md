# LeakLens Data Dictionary & Normalization Specification

**Database Engine:** Microsoft SQL Server 2022+ / Azure SQL Database  
**Architecture Standard:** Third Normal Form (3NF)  
**Timestamp Standard:** UTC via `DATETIMEOFFSET` (`SYSUTCDATETIME()`)  
**Security Posture:** Parameterized Access, Zero Plaintext Secrets, Role-Based Access Enforced  

---

## 1. Relational Entities Specification

### 1.1 `leaklens.users`
Stores user identities, authorization roles, and account lifecycle states.
- **Purpose:** System authentication, analyst assignment, and action attribution.

| Column | Data Type | Nullable | Constraints & Keys | Description |
|---|---|---|---|---|
| `user_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY`, Default `NEWSEQUENTIALID()` | Unique surrogate identifier for the user account. |
| `display_name` | `NVARCHAR(100)` | NO | None | Human-readable user name. |
| `email` | `NVARCHAR(256)` | NO | `UNIQUE`, `CHECK (LIKE '%_@__%.__%')` | Login email address and unique identity. |
| `password_hash` | `NVARCHAR(256)` | NO | None | Salted cryptographic password hash (Argon2id/Bcrypt). Never plaintext. |
| `role` | `NVARCHAR(32)` | NO | `CHECK (role IN ('admin', 'security_analyst', 'auditor', 'viewer'))` | RBAC access tier. |
| `is_active` | `BIT` | NO | Default `1` | Account status flag (1=Active, 0=Revoked/Deactivated). |
| `created_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC timestamp of registration. |
| `updated_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC timestamp of last profile/status modification. |

---

### 1.2 `leaklens.scan_jobs`
Tracks asynchronous file batch inspection jobs initiated by users or automated CI pipelines.
- **Purpose:** Orchestrates scan lifecycle and execution metadata.

| Column | Data Type | Nullable | Constraints & Keys | Description |
|---|---|---|---|---|
| `scan_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY`, Default `NEWSEQUENTIALID()` | Unique identifier for the scan job. |
| `created_by` | `UNIQUEIDENTIFIER` | NO | `FOREIGN KEY REFERENCES users(user_id)` | User or service identity that submitted the scan. |
| `status` | `NVARCHAR(32)` | NO | `CHECK (status IN ('pending', 'queued', 'in_progress', 'completed', 'failed', 'cancelled'))` | Current lifecycle state. |
| `started_at` | `DATETIMEOFFSET` | YES | None | UTC timestamp when worker engine picked up the scan. |
| `completed_at` | `DATETIMEOFFSET` | YES | `CHECK (completed_at >= started_at)` | UTC timestamp when processing terminated. |
| `error_code` | `NVARCHAR(64)` | YES | None | High-level failure reason code without sensitive internal traces. |
| `created_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC timestamp when job was enqueued. |

---

### 1.3 `leaklens.files`
Stores metadata and cryptographic fingerprints of files submitted for exposure inspection.
- **Purpose:** File metadata tracking, content deduplication, and Blob storage referencing.

| Column | Data Type | Nullable | Constraints & Keys | Description |
|---|---|---|---|---|
| `file_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY`, Default `NEWSEQUENTIALID()` | Unique identifier for the submitted file record. |
| `scan_id` | `UNIQUEIDENTIFIER` | NO | `FOREIGN KEY REFERENCES scan_jobs(scan_id) ON DELETE CASCADE` | Associated scan execution. |
| `original_filename` | `NVARCHAR(260)` | NO | None | Filename provided during upload (metadata only). |
| `blob_path` | `NVARCHAR(1024)` | YES | None | Private Azure Blob Storage reference (populated in Phase 2). |
| `content_hash` | `CHAR(64)` | NO | `CHECK (LEN(content_hash) = 64)` | SHA-256 cryptographic digest used for deduplication. |
| `file_size_bytes` | `BIGINT` | NO | `CHECK (file_size_bytes >= 0)` | File payload size in bytes. |
| `mime_type` | `NVARCHAR(128)` | NO | None | Detected or declared MIME type. |
| `created_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC upload timestamp. |

---

### 1.4 `leaklens.detection_rules`
Catalog of pattern signatures, entropy heuristics, and secret detection definitions.
- **Purpose:** Defines detection criteria, severity defaults, and rule categorization.

| Column | Data Type | Nullable | Constraints & Keys | Description |
|---|---|---|---|---|
| `rule_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY`, Default `NEWSEQUENTIALID()` | Unique rule identifier. |
| `rule_name` | `NVARCHAR(128)` | NO | `UNIQUE` | Distinct rule name (e.g. `aws-access-key`, `jwt-secret`). |
| `category` | `NVARCHAR(64)` | NO | `CHECK (category IN ('api_key', 'credentials', 'pii', 'financial', 'secret_key', 'infrastructure', 'custom'))` | Exposure classification category. |
| `description` | `NVARCHAR(512)` | NO | None | Documentation explaining the detected secret pattern. |
| `severity` | `NVARCHAR(16)` | NO | `CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info'))` | Default risk rating for matches. |
| `is_enabled` | `BIT` | NO | Default `1` | Activation toggle for scanning pipeline. |
| `created_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | Rule registration timestamp. |
| `updated_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | Last rule update timestamp. |

---

### 1.5 `leaklens.findings`
Contains individual sensitive-data exposure matches discovered in files.
- **Purpose:** Evidence capture with strict data masking to avoid secondary leakage.

| Column | Data Type | Nullable | Constraints & Keys | Description |
|---|---|---|---|---|
| `finding_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY`, Default `NEWSEQUENTIALID()` | Unique finding record identifier. |
| `file_id` | `UNIQUEIDENTIFIER` | NO | `FOREIGN KEY REFERENCES files(file_id) ON DELETE CASCADE` | File containing the exposure. |
| `rule_id` | `UNIQUEIDENTIFIER` | NO | `FOREIGN KEY REFERENCES detection_rules(rule_id) ON DELETE NO ACTION` | Rule triggered by the match. |
| `location_reference` | `NVARCHAR(256)` | NO | None | Line number (`line:45`), byte offset, or JSON path (`$.aws.secret`). |
| `masked_excerpt` | `NVARCHAR(512)` | NO | None | Masked preview (e.g. `AKIA****************`). Plaintext forbidden. |
| `severity` | `NVARCHAR(16)` | NO | `CHECK (severity IN ('critical', 'high', 'medium', 'low', 'info'))` | Evaluated severity rating. |
| `status` | `NVARCHAR(32)` | NO | `CHECK (status IN ('detected', 'confirmed', 'false_positive', 'suppressed', 'remediated'))` | Triage and lifecycle state. |
| `detected_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC detection timestamp. |

---

### 1.6 `leaklens.incidents`
Security tickets grouping exposure findings requiring investigation and containment.
- **Purpose:** Security operations management, analyst workflow, SLA tracking.

| Column | Data Type | Nullable | Constraints & Keys | Description |
|---|---|---|---|---|
| `incident_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY`, Default `NEWSEQUENTIALID()` | Unique incident identifier. |
| `title` | `NVARCHAR(256)` | NO | None | High-level incident headline (no sensitive secrets). |
| `description` | `NVARCHAR(1024)` | NO | None | Operational incident summary and scope. |
| `status` | `NVARCHAR(32)` | NO | `CHECK (status IN ('open', 'under_investigation', 'contained', 'resolved', 'closed'))` | Incident ticket state. |
| `priority` | `NVARCHAR(16)` | NO | `CHECK (priority IN ('critical', 'high', 'medium', 'low'))` | Incident handling urgency. |
| `assigned_to` | `UNIQUEIDENTIFIER` | YES | `FOREIGN KEY REFERENCES users(user_id) ON DELETE SET NULL` | Assigned security analyst. |
| `created_by` | `UNIQUEIDENTIFIER` | NO | `FOREIGN KEY REFERENCES users(user_id) ON DELETE NO ACTION` | User who opened the ticket. |
| `created_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC incident creation time. |
| `updated_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC last triage modification time. |
| `resolved_at` | `DATETIMEOFFSET` | YES | `CHECK (resolved_at IS NULL OR status IN ('resolved', 'closed'))` | UTC closure/resolution timestamp. |

---

### 1.7 `leaklens.incident_findings` (Junction Table)
Models the many-to-many relationship connecting incidents with related findings.
- **Purpose:** Eliminates repeating groups and enables grouping multiple findings into one incident.

| Column | Data Type | Nullable | Constraints & Keys | Description |
|---|---|---|---|---|
| `incident_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY (Part 1)`, `FOREIGN KEY REFERENCES incidents(incident_id) ON DELETE CASCADE` | Associated incident. |
| `finding_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY (Part 2)`, `FOREIGN KEY REFERENCES findings(finding_id) ON DELETE NO ACTION` | Associated finding. |
| `linked_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC timestamp when finding was added to incident. |

---

### 1.8 `leaklens.remediation_actions`
Documents defensive containment and remediation steps taken by security analysts.
- **Purpose:** Chronological audit of key rotations, revocations, and fixes.

| Column | Data Type | Nullable | Constraints & Keys | Description |
|---|---|---|---|---|
| `action_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY`, Default `NEWSEQUENTIALID()` | Unique remediation action record. |
| `incident_id` | `UNIQUEIDENTIFIER` | NO | `FOREIGN KEY REFERENCES incidents(incident_id) ON DELETE CASCADE` | Target incident being addressed. |
| `user_id` | `UNIQUEIDENTIFIER` | NO | `FOREIGN KEY REFERENCES users(user_id) ON DELETE NO ACTION` | Analyst executing the action. |
| `action_type` | `NVARCHAR(64)` | NO | `CHECK (action_type IN ('secret_revocation', 'key_rotation', 'access_revocation', 'file_quarantine', 'false_positive_acknowledgement', 'policy_update', 'custom'))` | Category of containment action. |
| `notes` | `NVARCHAR(1024)` | NO | None | Justification and verification notes (no raw secrets). |
| `created_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC timestamp of action execution. |

---

### 1.9 `leaklens.audit_logs`
Immutable system audit trail recording defensive actions, access changes, and scan triggers.
- **Purpose:** Compliance, forensic non-repudiation, and tamper-resistant event logging.

| Column | Data Type | Nullable | Constraints & Keys | Description |
|---|---|---|---|---|
| `audit_id` | `UNIQUEIDENTIFIER` | NO | `PRIMARY KEY`, Default `NEWSEQUENTIALID()` | Unique audit event ID. |
| `user_id` | `UNIQUEIDENTIFIER` | YES | `FOREIGN KEY REFERENCES users(user_id) ON DELETE SET NULL` | Performing user ID, or NULL if triggered by system background process. |
| `event_type` | `NVARCHAR(64)` | NO | None | Action identifier (e.g. `incident_resolved`, `rule_updated`). |
| `entity_type` | `NVARCHAR(64)` | NO | None | Impacted entity domain (`incident`, `scan_job`, `finding`). |
| `entity_id` | `NVARCHAR(64)` | NO | None | Primary key of impacted entity. |
| `metadata_json` | `NVARCHAR(MAX)` | YES | `CHECK (ISJSON(metadata_json) = 1)` | Structured context without raw passwords or keys. |
| `created_at` | `DATETIMEOFFSET` | NO | Default `SYSUTCDATETIME()` | UTC timestamp of event entry. |

---

## 2. Normalization Analysis (1NF, 2NF, 3NF)

The LeakLens relational schema has been designed from first principles to strictly satisfy **Third Normal Form (3NF)**.

### 2.1 First Normal Form (1NF)
A relation is in 1NF if and only if all attribute values are atomic (indivisible) and there are no repeating groups.
1. **Atomic Attributes:** Columns such as `location_reference`, `content_hash`, `email`, and `status` store single, indivisible values. Composite values like name and domain are handled properly, and JSON payloads in `audit_logs` are strictly constrained contextual envelopes, not primary relational join keys.
2. **Elimination of Repeating Groups:** Rather than storing multiple finding identifiers inside an incident table row (e.g. `finding_id_1`, `finding_id_2`, or comma-separated lists), the `incident_findings` junction table externalizes this relationship into discrete, atomic tuple entries.

### 2.2 Second Normal Form (2NF)
A relation is in 2NF if it is in 1NF and every non-key attribute is fully functionally dependent on the primary key (no partial dependencies on a composite key).
1. In all single-column primary key tables (`users`, `scan_jobs`, `files`, `detection_rules`, `findings`, `incidents`, `remediation_actions`, `audit_logs`), partial key dependencies are mathematically impossible.
2. In the only table possessing a composite primary key (`incident_findings` with `PK(incident_id, finding_id)`), the single non-key attribute `linked_at` describes the moment the relationship itself was established. It depends on the combined pairing of both `incident_id` AND `finding_id`, not solely on `incident_id` or `finding_id`. Hence, no partial dependency exists.

### 2.3 Third Normal Form (3NF)
A relation is in 3NF if it is in 2NF and no non-key attribute is transitively dependent on the primary key (every non-key attribute depends directly on the key, the whole key, and nothing but the key).
1. **Users Separated from Scan Jobs:** If analyst details (name, email, role) were embedded inside `scan_jobs`, updating an analyst's email would produce an update anomaly across thousands of historical scan rows. Moving user data to `leaklens.users` eliminates transitive dependency: `scan_id -> created_by -> email`.
2. **Rules Separated from Findings:** If rule names, categories, and severity descriptions were stored directly in `findings`, altering a rule definition would require updating millions of finding records. Instead, `findings.rule_id` references `detection_rules`, ensuring `finding_id -> rule_id -> rule_name` does not violate 3NF.
3. **Files Separated from Scan Jobs:** A single scan can process thousands of files. Storing file metadata (`original_filename`, `content_hash`, `file_size_bytes`) directly in `scan_jobs` would cause massive data duplication and repeating groups.
4. **Remediation Actions Separated from Incidents:** An incident may undergo multiple remediation steps (e.g. file quarantine followed by secret key rotation and analyst notes). Storing actions in `remediation_actions` linked to `incident_id` preserves 3NF and eliminates repeating columns.

---

## 3. Deletion and Retention Strategy

| Table | Referential Action on Delete | Retention / Archival Policy |
|---|---|---|
| `users` | `ON DELETE NO ACTION` / `SET NULL` on audit | Users are soft-deactivated via `is_active = 0` to preserve auditability and forensic integrity. Hard deletes are restricted. |
| `scan_jobs` | `ON DELETE NO ACTION` from users | Retained for 90 days minimum; cascade drops associated `files` and `findings` only upon authorized tenant purge. |
| `files` | `ON DELETE CASCADE` from scan jobs | Metadata purged concurrently with parent scan job. |
| `detection_rules` | `ON DELETE NO ACTION` from findings | Rules are deactivated via `is_enabled = 0`. Hard deletes are forbidden if historical findings reference the rule. |
| `findings` | `ON DELETE CASCADE` from files | Retained in accordance with compliance SLAs. |
| `incidents` | `ON DELETE CASCADE` to junction and remediation | Incidents transition to `closed` status; hard deletes are prohibited under standard security operations. |
| `incident_findings` | `ON DELETE CASCADE` from incident | Unlinks findings if incident is deleted without destroying original finding evidence. |
| `remediation_actions` | `ON DELETE CASCADE` from incident | Preserved alongside incident record. |
| `audit_logs` | `ON DELETE SET NULL` from user | Append-only immutable log. Hard deletes prohibited; archived to long-term cold storage after 365 days. |
