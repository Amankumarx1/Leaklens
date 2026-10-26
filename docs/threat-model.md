# LeakLens Comprehensive Cloud Security Threat Model

## 1. Overview & Methodology

This threat model identifies potential attack surfaces, trust boundaries, threat scenarios, and defensive mitigations for **LeakLens — Authorized Data Exposure Detection & Response**.

The methodology follows the **STRIDE** model (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) combined with OWASP Top 10 API Security Risks and the Azure Security Benchmark.

---

## 2. Trust Boundaries & Architectural Assets

```
[ Untrusted External Zone: Web Browsers, Public Networks ]
                         │
                         ▼ [ Trust Boundary 1: TLS Termination & Reverse Proxy ]
┌────────────────────────────────────────────────────────┐
│ Perimeter Zone: Azure App Service / Express Server     │
│ - Cookie-based JWT Session Verification                │
│ - Server-Side Role-Based Access Control (RBAC)         │
│ - Request Body & MIME Validation                       │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼ [ Trust Boundary 2: Service-to-Service Managed Identity ]
┌────────────────────────────────────────────────────────────────────────┐
│ Secure Data Plane: Azure Storage, SQL, and Key Vault                   │
│ - Azure Blob Storage: Private Container 'leaklens-scans'               │
│ - Azure SQL Database: Encrypted TDS on Port 1433                       │
│ - Azure Key Vault: Azure RBAC Mode for Runtime Secrets                 │
└────────────────────────────────────────────────────────────────────────┘
```

### Critical Assets to Protect
1. **Confidentiality:** Authorised scanned files, detected sensitive credentials, and application secrets.
2. **Integrity:** Relational scan metadata, findings classifications, incident states, and audit trails.
3. **Availability:** File inspection pipeline and operational readiness probes.
4. **Accountability:** Non-repudiation of security analyst containment and resolution actions.

---

## 3. Detailed Threat Scenarios & Mitigations

---

### Threat 1: Unauthorized Access & Horizontal/Vertical Privilege Escalation
- **STRIDE Category:** Elevation of Privilege / Information Disclosure.
- **Attack Scenario:** An unauthenticated user attempts to view sensitive findings via `GET /api/findings`, or a `COMPLIANCE_REVIEWER` attempts to initiate scans (`POST /api/scans`) or resolve an incident (`POST /api/incidents/:id/resolve`).
- **Potential Impact:** Unauthorized viewing of exposed credentials; tampering with incident investigations.
- **Implemented Mitigations:**
  1. Centralized authentication middleware (`authenticateToken`) verifies cryptographically signed JWTs stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookies.
  2. Role-based middleware (`requireRole(['ADMIN', 'ANALYST'])`) strictly gates mutation endpoints.
  3. Safe 401 Unauthorized and 403 Forbidden responses return structured error codes without leaking internal stack traces.
- **Verification Evidence:** `tests/auth.rbac.test.js` (7 automated tests verifying token validity, role denial, and permission boundaries).
- **Residual Risk:** Compromise of an active analyst workstation session; mitigated by short-lived token lifetimes and session revocations.

---

### Threat 2: Malicious & Adversarial File Uploads
- **STRIDE Category:** Denial of Service / Remote Code Execution.
- **Attack Scenario:** An attacker uploads a multi-gigabyte file to cause disk or memory exhaustion (Denial of Service), or submits an executable binary disguised as a text file to exploit parser vulnerabilities.
- **Potential Impact:** Server crash, memory starvation, arbitrary code execution on backend worker nodes.
- **Implemented Mitigations:**
  1. Strict file size cap (10MB) enforced at the Multer middleware layer before full buffering.
  2. Extension and MIME type whitelisting restricted strictly to `.txt` (`text/plain`), `.json` (`application/json`), and `.csv` (`text/csv`).
  3. Rejection of empty buffers (`EMPTY_FILE`).
  4. Files stored in memory buffers during parsing rather than arbitrary temporary directories on the App Service disk.
- **Verification Evidence:** `tests/scanner.upload.test.js` (7 automated tests verifying size limits, extension rejections, and empty file handling).
- **Residual Risk:** Highly nested or malformed JSON causing parser CPU spikes; mitigated by strict JSON parsing try/catch wrappers and request timeout caps (30s).

---

### Threat 3: Secret Exposure & Secondary Leakage
- **STRIDE Category:** Information Disclosure.
- **Attack Scenario:** A detected production AWS secret key or database connection string is logged in plaintext to application console logs, forwarded to external SIEM tools, or returned unmasked in API responses.
- **Potential Impact:** A security tool intended to identify leaks inadvertently creates a secondary, catastrophic leak.
- **Implemented Mitigations:**
  1. In-memory masking service (`maskingService.js`) immediately transforms raw secrets into masked excerpts (e.g., `ghp_***_890`, `AKIA***SAMPLE`) before database persistence.
  2. Raw detected secrets are never persisted in the `leaklens.findings` table or relational database schema.
  3. Sanitized request logger (`requestLogger.js`) explicitly redacts sensitive keys (`password`, `token`, `secret`, `file_content`).
  4. Health and readiness endpoints (`/api/health`, `/api/health/ready`) redact all database passwords and connection strings.
- **Verification Evidence:** `tests/security.secrets.test.js`, `tests/scanner.detection.test.js`, and `tests/cloud.integration.test.js`.
- **Residual Risk:** Custom or unrecognized secret patterns not caught by existing regex rules; mitigated by regular rule updates.

---

### Threat 4: SQL Injection
- **STRIDE Category:** Tampering / Information Disclosure.
- **Attack Scenario:** An attacker crafts malicious SQL fragments in user input fields (e.g., incident title, remediation notes, search queries) to alter query execution or exfiltrate database records.
- **Potential Impact:** Database exfiltration, unauthorized privilege escalation, or destructive table tampering.
- **Implemented Mitigations:**
  1. 100% of SQL queries executed through `server/src/database/connection.js` utilize strictly parameterized `mssql` request inputs (`request.input(key, type, value)`). Zero string concatenation.
  2. Incident resolution logic is locked inside an atomic stored procedure (`leaklens.sp_resolve_incident`) using parameterized stored procedure execution.
  3. Principle of least privilege: The application's database principal is restricted to DML on the `leaklens` schema and execution of `sp_resolve_incident`.
- **Verification Evidence:** `server/src/repositories/*.js` and `tests/database.schema.test.js`.
- **Residual Risk:** Low; strictly eliminated through universal parameterized query enforcement.

---

### Threat 5: Stored & Reflected Cross-Site Scripting (XSS)
- **STRIDE Category:** Tampering / Elevation of Privilege.
- **Attack Scenario:** An attacker uploads a file with a malicious name (e.g., `<script>alert('pwn')</script>.txt`) or enters script payloads in incident remediation notes, hoping it executes in an analyst's browser.
- **Potential Impact:** Session token theft, UI defacement, or forged API requests executed under analyst authority.
- **Implemented Mitigations:**
  1. React's virtual DOM natively escapes strings before rendering text nodes.
  2. Hardened HTTP Content Security Policy (CSP):
     `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none';`
  3. `X-Frame-Options: DENY` blocks clickjacking and iframe embedding.
  4. `X-Content-Type-Options: nosniff` prevents browser MIME confusion attacks.
- **Verification Evidence:** `server/src/app.js` and `tests/cloud.integration.test.js`.
- **Residual Risk:** Misuse of `dangerouslySetInnerHTML`; verified that 0 instances exist in the entire client codebase.

---

### Threat 6: Azure Cloud Resource Compromise & Public Exfiltration
- **STRIDE Category:** Information Disclosure / Tampering.
- **Attack Scenario:** An external attacker accesses the Azure Storage Account directly via HTTP to download uploaded files, or connects directly to the Azure SQL server over the public internet.
- **Potential Impact:** Mass exfiltration of uploaded organizational files and relational database records.
- **Implemented Mitigations:**
  1. Anonymous public access is completely disabled on the Storage Account (`allowBlobPublicAccess: false`) and private access is enforced on the container (`publicAccess: 'None'`).
  2. Non-reversible randomized blob paths (`scans/{scan_id}/{file_id}.bin`) prevent path guessing or predictable enumeration.
  3. Managed Identity authentication: App Service authenticates to Blob Storage and Key Vault using Entra ID (`DefaultAzureCredential`), eliminating long-lived storage connection strings or account keys from deployment files.
  4. Azure SQL enforces TLS 1.2+ encryption (`encrypt: true`) and validates certificates in production (`trustServerCertificate: false`).
- **Verification Evidence:** `infra/azure/main.bicep`, `docs/azure-network-security.md`, and `tests/cloud.integration.test.js`.
- **Residual Risk:** Azure Data Center IP firewall broadness in low-cost mode; mitigated in enterprise mode by deploying Azure Private Endpoints.

---

### Threat 7: Audit Trail Tampering & Workflow Inconsistency
- **STRIDE Category:** Repudiation / Tampering.
- **Attack Scenario:** A malicious analyst attempts to alter their remediation history, or a network failure during incident resolution causes findings to update without an accompanying audit log entry.
- **Potential Impact:** Regulatory compliance failure, loss of forensic non-repudiation, and corrupted audit logs.
- **Implemented Mitigations:**
  1. The `leaklens.audit_logs` table has no `UPDATE` or `DELETE` grants for ordinary application users. It is an append-only audit ledger.
  2. Multi-operation incident resolutions are wrapped inside an atomic SQL transaction in `sp_resolve_incident`. If an audit log insert fails, the entire transaction rolls back.
  3. Dual-phase failure rollback: If a scan fails midway, compensating cleanup (`deleteBlob`) purges the uploaded blob to prevent orphaned state.
- **Verification Evidence:** `database/procedures.sql` and `tests/incident.workflow.test.js`.
- **Residual Risk:** Database administrator level tampering; mitigated in enterprise production by streaming audit events to Azure Log Analytics / Azure Monitor with WORM (Write Once, Read Many) immutability policies.

---

### Threat 8: Secret & Deployment Configuration Leakage
- **STRIDE Category:** Information Disclosure.
- **Attack Scenario:** A developer accidentally commits API keys, database passwords, or JWT secrets to the public GitHub repository or embeds them into client-side Vite bundles.
- **Potential Impact:** Immediate, catastrophic compromise of cloud infrastructure.
- **Implemented Mitigations:**
  1. Comprehensive `.gitignore` excludes `.env`, `*.pem`, `*.key`, and deployment zips.
  2. Azure Key Vault provides runtime secret resolution for `SESSION_SECRET` and `JWT_SECRET`.
  3. Client-side Vite configuration does not expose server environment variables or database connection strings.
  4. Automated secret pattern scanning and test assertions verify that git diffs contain zero plaintext passwords.
- **Verification Evidence:** `tests/security.secrets.test.js` and `.env.example`.
- **Residual Risk:** Accidental hardcoding in local developer test files; mitigated by pre-commit hooks and CI/CD secret scanning.
