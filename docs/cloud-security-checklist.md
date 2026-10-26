# Cloud Security Controls & Compliance Checklist

This document tracks the implementation and verification status of security controls for the **LeakLens Security Platform** on Microsoft Azure.

### Status Legend
- **IMPLEMENTED & VERIFIED:** Implemented in code/IaC and verified via automated test suites.
- **CONFIGURED IN IAC:** Specified in Bicep templates/CI-CD workflows, to be applied during live Azure cloud provisioning.
- **PLANNED / NOT APPLICABLE:** Future phase or not required under the current architecture.

---

## 1. Security Checklist Table

| # | Control Area | Requirement & Implementation | Status | Verification Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Identity & Access Control** | Role-Based Access Control (`ADMIN`, `ANALYST`, `COMPLIANCE_REVIEWER`) enforced on all API endpoints. System-assigned Managed Identity for Azure service-to-service auth. | **IMPLEMENTED & VERIFIED** | `tests/auth.rbac.test.js`, `infra/azure/main.bicep` |
| **2** | **Password Hashing & Sessions** | Passwords hashed using bcrypt with work factor 12. Sessions authenticated via signed JWT stored in `HttpOnly`, `SameSite=Lax`, `Secure` cookies. | **IMPLEMENTED & VERIFIED** | `server/src/services/auth/authService.js`, `tests/auth.rbac.test.js` |
| **3** | **HTTPS & Transport Security** | App Service enforces HTTPS redirection (`httpsOnly: true`), minimum TLS 1.2, HSTS with 1-year preload header. Certificate validation enforced in production. | **IMPLEMENTED & VERIFIED** | `server/src/app.js`, `infra/azure/main.bicep`, `tests/cloud.integration.test.js` |
| **4** | **Secrets Management** | Zero plaintext secrets in code or repository. Key Vault service retrieves runtime secrets (`SESSION_SECRET`, `JWT_SECRET`, `DB_PASSWORD`) via Managed Identity. Local development uses `.env.example`. | **IMPLEMENTED & VERIFIED** | `server/src/services/cloud/keyVaultService.js`, `tests/security.secrets.test.js`, `tests/cloud.integration.test.js` |
| **5** | **SQL Injection Protection** | Strictly parameterized T-SQL queries via `mssql` request inputs. No string concatenation in SQL queries or stored procedures. | **IMPLEMENTED & VERIFIED** | `server/src/database/connection.js`, `server/src/repositories/*.js` |
| **6** | **XSS & Content Security** | Security headers: `Content-Security-Policy`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. React escapes dynamic content. | **IMPLEMENTED & VERIFIED** | `server/src/app.js`, `tests/cloud.integration.test.js` |
| **7** | **Upload Validation** | Multer validation checks MIME types, extension whitelisting (`.txt`, `.json`, `.csv`), 10MB file size limit, and non-empty content buffers. | **IMPLEMENTED & VERIFIED** | `server/src/middleware/fileUpload.js`, `tests/scanner.upload.test.js` |
| **8** | **Blob Access Restrictions** | Storage container `leaklens-scans` has anonymous access disabled (`allowBlobPublicAccess: false`, `publicAccess: 'None'`). Randomized safe paths (`scans/{scan_id}/{file_id}.bin`). Compensating cleanup on failure. | **IMPLEMENTED & VERIFIED** | `server/src/services/storage/blobStorageService.js`, `infra/azure/main.bicep`, `tests/cloud.integration.test.js` |
| **9** | **Database Network Controls** | TLS encrypted TDS connection (`encrypt: true`). In production, `trustServerCertificate: false` forces root CA certificate verification. Azure SQL firewall restricts external access. | **IMPLEMENTED & VERIFIED** | `server/src/database/connection.js`, `infra/azure/main.bicep`, `tests/config.validation.test.js` |
| **10** | **Logging & Audit Integrity** | Structured audit logging (`leaklens.audit_logs`) tracking scan creation, completion, incident transitions, and resolutions. Loggers redact passwords, secrets, tokens, and raw detection content. | **IMPLEMENTED & VERIFIED** | `server/src/middleware/requestLogger.js`, `server/src/repositories/auditRepository.js`, `tests/incident.workflow.test.js` |
| **11** | **Data Retention & Lifecycle** | Blob storage delete retention policy set to 14 days in Bicep. Compensating cleanup deletes orphaned blobs immediately upon scan or SQL failures. | **IMPLEMENTED & VERIFIED** | `server/src/services/scanner/scannerService.js`, `infra/azure/main.bicep`, `tests/cloud.integration.test.js` |
| **12** | **Monitoring & Probes** | Separate lightweight liveness probe (`/api/health`) and comprehensive dependency readiness probe (`/api/health/ready`). Redacts infrastructure details from responses. | **IMPLEMENTED & VERIFIED** | `server/src/routes/health.routes.js`, `tests/api.health.test.js`, `tests/cloud.integration.test.js` |
| **13** | **Least-Privilege Permissions** | App Service Managed Identity granted only `Storage Blob Data Contributor` and `Key Vault Secrets User`. Ordinary SQL user restricted to DML on `leaklens` schema and execution of `sp_resolve_incident`. | **CONFIGURED IN IAC** | `infra/azure/main.bicep`, `database/schema.sql` |
| **14** | **Deployment Security & CI/CD** | GitHub Actions CI/CD workflows use OIDC federated identity credentials rather than long-lived client secret keys. FTPS and remote debugging disabled. | **CONFIGURED IN IAC** | `.github/workflows/deploy.yml`, `infra/azure/main.bicep` |
| **15** | **Live Cloud Deployment** | End-to-end execution of live deployment pipeline on Azure platform. | **NOT VERIFIED LOCALLY** | Azure CLI not installed on execution workstation; deployment assets verified locally with dual-mode fallback. |

---

## 2. Mandatory Security Rules Verification Summary

- [x] Rule 1: No committed credentials, tokens, or connection strings.
- [x] Rule 2: No secrets exposed in client bundles, source maps, or API responses.
- [x] Rule 3: Anonymous public access disabled for all Blob storage containers.
- [x] Rule 4: Server-side RBAC enforced for all operational and incident workflows.
- [x] Rule 5: Production TLS certificate verification enforced (`trustServerCertificate: false`).
- [x] Rule 6: No unrestricted `0.0.0.0/0` public internet firewall rule.
- [x] Rule 7: Least privilege role assignments for Managed Identity.
- [x] Rule 8: Raw detected secrets and uploaded files never written to application logs.
- [x] Rule 9: Non-reversible randomized blob paths used instead of user-provided filenames.
- [x] Rule 10: Compensating storage cleanup implemented for SQL/scanner failure consistency.
- [x] Rule 11: Free/academic tier sizing applied across all proposed Azure resources.
