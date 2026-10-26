# Cloud Security & Application Hardening — Viva Defense Guide

## 1. Authentication & Session Defense

### 1.1 Password Hashing & Salt Generation
- **Algorithm:** **Bcrypt** with salt rounds cost factor 12 (`bcryptjs.hash(password, 12)`).
- **Protection:** Defends against offline pre-computation dictionary attacks and Rainbow Tables.
- **Timing Attack Mitigation:** Constant-time verification (`bcrypt.compare`) prevents attackers from deducing hash prefixes based on execution duration.

### 1.2 Session Token Storage: Cookies vs. LocalStorage
- **Viva Defense Question:** *"Why did you store JWTs in HttpOnly cookies instead of browser localStorage?"*
- **Technical Answer:** Storing authentication tokens in `localStorage` makes them directly accessible to any JavaScript executing in the browser context. If an application suffers from a minor Cross-Site Scripting (XSS) flaw or vulnerable third-party npm package, an attacker can extract `localStorage.getItem('token')` and hijack the session. By storing the token in an **`HttpOnly` cookie**, the browser prevents client-side scripts from reading the token. Furthermore, `SameSite=Lax` prevents Cross-Site Request Forgery (CSRF) on cross-origin requests, and `Secure` ensures cookies are only transmitted across encrypted HTTPS connections.

---

## 2. Server-Side Role-Based Access Control (RBAC)

### Three Rigorous Roles:
1. **`ADMIN`:** Full administrative control, user provisioning, scan execution, and incident resolution.
2. **`ANALYST`:** Security operations triage, scan initiation, incident assignment, investigation notes, and verification.
3. **`COMPLIANCE_REVIEWER`:** Read-only visibility into dashboards, findings, and audit trails. **Explicitly denied scan initiation or incident resolution (HTTP 403 Forbidden).**

### Enforcement Mechanism:
Authorization is enforced on the Express router level via middleware:
```javascript
router.post('/scans', authenticateToken, requireRole(['ADMIN', 'ANALYST']), upload.single('file'), scanController.createScan);
```
Even if a malicious user alters the client-side UI to render a hidden button, direct API calls are rejected with HTTP 403.

---

## 3. Azure Cloud Identity: System-Assigned Managed Identity

### Eliminating Long-Lived Credentials:
- **Traditional Insecure Pattern:** Storing Azure Storage connection strings and Key Vault client secrets in configuration files or deployment scripts.
- **LeakLens Pattern:** The Azure App Service Linux instance runs with a **System-Assigned Managed Identity** enabled (`identity: { type: 'SystemAssigned' }`).
- **Role Assignments in Bicep (`main.bicep`):**
  - Storage Account: `Storage Blob Data Contributor` (ID: `ba92f5b4-2d11-453d-a403-e96b0029c9fe`).
  - Key Vault: `Key Vault Secrets User` (ID: `4633458b-17de-408a-b874-0445c86b69e6`).
- **SDK Authentication:** The backend uses `@azure/identity`'s `DefaultAzureCredential()`, which automatically requests short-lived Microsoft Entra ID OAuth tokens directly from the Azure App Service metadata service endpoint (`http://169.254.169.254/metadata/identity/oauth2/token`). Zero credentials are saved on disk or in source control.

---

## 4. In-Memory Sensitive-Data Redaction

### Zero Secondary Exposure:
A defensive scanner must not become a source of credential leakage:
- When regex signatures identify secrets in memory buffers:
  ```javascript
  // Raw Secret
  ghp_1234567890abcdef1234567890abcdef1234
  // In-Memory Redacted Excerpt
  ghp_***_1234
  ```
- The finding record persisted to SQL Server receives **only the masked excerpt**.
- Raw files in Azure Blob Storage are retained only for the documented 14-day operational lifecycle, accessible exclusively by the backend managed identity.
- Application request loggers explicitly redact headers and request keys (`requestLogger.js`).
- Health probes (`/api/health`, `/api/health/ready`) never output database connection strings or secret names.

---

## 5. Defense Against SQL Injection & XSS

### SQL Injection Prevention:
- 100% of database interactions in `server/src/repositories/*.js` use parameterized `mssql` request inputs:
  ```javascript
  request.input('severity', sql.NVarChar(16), severity);
  request.query('SELECT ... WHERE severity = @severity');
  ```
- No user-controlled string concatenation in SQL queries.

### XSS Prevention & Security Headers:
- React virtual DOM safely escapes rendered strings.
- Production Express headers applied via middleware:
  - `Content-Security-Policy: default-src 'self'; ...`
  - `X-Frame-Options: DENY` (Blocks Clickjacking)
  - `X-Content-Type-Options: nosniff` (Blocks MIME Confusion)
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` (Forces HTTPS)
