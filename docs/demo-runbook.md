# LeakLens Academic Viva Demonstration Runbook

## 1. Overview & Purpose

This runbook provides a reproducible, step-by-step procedure for demonstrating **LeakLens — Authorized Data Exposure Detection & Response** during an academic viva defense, project evaluation, or peer code review.

The demonstration uses purely synthetic demonstration data and operates seamlessly in both **Live Azure Cloud Mode** and **Local Offline Mode** (using built-in in-memory fallback stores).

---

## 2. Demonstration Prerequisites & Environment Setup

### 2.1 Start Local Platform (Offline / Demonstration Mode)
```bash
# 1. From repository root, install dependencies if not already present
npm run install:all

# 2. Build the production React frontend bundle
npm run build:client

# 3. Start the Express server (serves both API and compiled SPA on port 3000)
npm run start
```
*The platform will initialize at `http://localhost:3000` (or `http://localhost:5173` if running Vite dev server via `npm run dev`).*

### 2.2 Provisioned Demonstration Accounts

| Role | Email Address | Initial Password | Permitted Actions in Demo |
| :--- | :--- | :--- | :--- |
| **Security Admin** | `admin@leaklens.local` | `Admin@LeakLens2026!` | Full access: scanning, incident creation, assignment, resolution, audit inspection. |
| **Security Analyst** | `analyst@leaklens.local` | `Analyst@LeakLens2026!` | Triage, incident investigation, key rotation notes, independent verification. |
| **Compliance Reviewer** | `reviewer@leaklens.local` | `Reviewer@LeakLens2026!` | Read-only access: dashboard, findings, audit logs. **Forbidden from scans/resolutions (403).** |

---

## 3. Creating Synthetic Demonstration Test Files

To demonstrate multi-format scanning without using real credentials, create these synthetic test fixtures:

### Synthetic File 1: `synthetic-cloud-config.txt` (Text Payload)
```text
# Production Server Configuration (Synthetic Test Data)
ENVIRONMENT=production
REGION=eastus
API_KEY=sk_demo_9876543210abcdef98765432
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
CONTACT_EMAIL=security-ops@leaklens-demo.local
```

### Synthetic File 2: `synthetic-api-keys.json` (JSON Payload)
```json
{
  "service": "payment-gateway",
  "client_id": "LL-ID-A901-B234",
  "auth_token": "key_test_1234567890abcdef1234567890abcdef1234",
  "admin_contact": "admin@leaklens-demo.local"
}
```

### Synthetic File 3: `synthetic-database-export.csv` (CSV Payload)
```csv
id,system_name,credential_string,assigned_lead
1,AppDB,"Server=tcp:sql-leaklens.net;Database=ProductionDB;User ID=sa;Password=SyntheticP@ssw0rd!;",analyst@leaklens.local
2,CacheNode,"redis://:synthetic_auth_token_12345@cache.leaklens.net:6379",admin@leaklens.local
```

---

## 4. Step-by-Step Demonstration Script (8–12 Minutes)

---

### Step 1: Authentication & Role Verification (1.5 Mins)
1. Navigate to `http://localhost:3000/login`.
2. Click the **"Security Admin"** quick-role card (or enter `admin@leaklens.local` / `Admin@LeakLens2026!`).
3. Click **"Sign In to Console"**.
4. *Expected Result:* User session is established via signed JWT stored in an `HttpOnly` cookie. Redirects to `/dashboard`.
5. *Talking Point:* Explain that passwords use salted bcrypt hashing (work factor 12) and that sessions use secure cookie-based tokens to prevent XSS exfiltration.

---

### Step 2: Security Posture Dashboard & System Health (1 Min)
1. On `/dashboard`, highlight the live metrics: Total Completed Scans, Total Findings, and Severity Distribution.
2. Note the system status pill in the header: `Healthy` (connected via `/api/health`).
3. *Talking Point:* Explain that `/api/health` reports liveness while `/api/health/ready` validates external Azure dependencies (SQL, Blob Storage, Key Vault) without exposing database credentials or internal hostnames.

---

### Step 3: Authorized File Upload & Scanning (2 Mins)
1. Click **"New Scan"** in the sidebar (navigates to `/scans/new`).
2. Drag and drop or browse for `synthetic-cloud-config.txt`.
3. Click **"Start Authorized Scan"**.
4. *Expected Result:* File is parsed, uploaded to private Azure Blob Storage (`leaklens-scans`), scanned by regex pattern signatures, and redirected to `/scans/:id`.
5. *Talking Point:* Highlight the non-reversible randomized storage path: `scans/{scan_id}/{file_id}.bin`. Explain compensating cleanup: if downstream SQL insertion fails, the uploaded blob is immediately deleted to prevent orphaned sensitive files.

---

### Step 4: Masking & Evidence Inspection (1.5 Mins)
1. Inspect the Scan Detail view.
2. Observe that findings are displayed with masked excerpts:
   - `sk_demo_***_432` (High)
   - `AKIA***SAMPLE` (Critical)
   - `sec***@***.local` (Low)
3. *Talking Point:* Explain that raw detected secrets are never persisted in the database. In-memory redaction occurs before relational `INSERT`, ensuring zero secondary exposure.

---

### Step 5: Incident Escalation & Assignment (1.5 Mins)
1. Navigate to **"Findings"** (`/findings`).
2. Select the checkbox for the critical `AWS_ACCESS_KEY` finding.
3. Click **"Escalate to Incident"** (navigates to `/incidents/new`).
4. Enter Title: `Critical AWS Credential Exposure in Cloud Config`.
5. Select Priority: `CRITICAL`.
6. Select Lead Analyst: `Lead Security Analyst` (`analyst@leaklens.local`).
7. Click **"Create Incident"**.
8. *Expected Result:* Incident created in `OPEN` status with `version = 1`. Redirects to the Incident Workspace (`/incidents/:id`).

---

### Step 6: Investigation, Verification & Atomic Resolution (2.5 Mins)
1. On the Incident Workspace:
   - Click **"Change Status"** $\to$ select `IN_PROGRESS` $\to$ click Confirm.
   - Click **"Log Action"** $\to$ select `Remediation` $\to$ Enter: `AWS key revoked in IAM console and rotated to Key Vault.` $\to$ Submit.
   - Click **"Record Verification"** $\to$ select `PASSED` $\to$ Enter: `Verified IAM key deletion returns 403 Access Denied.` $\to$ Submit.
   - Click **"Resolve Incident"** $\to$ Enter Resolution Summary: `Credential successfully revoked and replaced.` $\to$ Confirm Resolution.
2. *Expected Result:* 
   - Incident transitions to `RESOLVED` status.
   - Associated finding status updates to `remediated`.
   - Incident Activity Timeline displays complete chronological audit history.
3. *Talking Point (RDBMS Focus):* Explain that resolution invokes stored procedure `leaklens.sp_resolve_incident`. The status update, finding remediation, remediation action insertion, and audit trail record occur within an **atomic database transaction**. If any step fails, the entire transaction rolls back.

---

### Step 7: Forensic Audit Trail & Analytics Verification (1.5 Mins)
1. Navigate to **"Audit Logs"** (`/audit-logs`).
   - Observe the append-only log entries: `scan_created`, `scan_completed`, `incident_created`, `incident_action_logged`, `incident_resolved`.
   - Click **"View Details"** on the resolution event to show the structured JSON metadata.
2. Navigate to **"Analytics"** (`/analytics`).
   - Observe updated KPI cards: Mean Time to Remediate (MTTR), resolution duration, and incident funnel.
   - Click the **"Power BI DirectQuery Config"** tab to display connection parameters.
   - Click the **"DAX Measures Catalog"** tab to review calculated formulas.

---

### Step 8: Role-Based Access Control Denial Test (0.5 Mins)
1. Sign out and sign in as `compliance@leaklens.local` (`Reviewer@LeakLens2026!`).
2. Attempt to navigate to `http://localhost:3000/scans/new` or trigger a scan.
3. *Expected Result:* The upload button is disabled and backend API rejects unauthorized requests with HTTP 403 Forbidden.
4. *Talking Point:* Proves that authorization is enforced on the server, not just hidden in the frontend UI.

---

## 5. Troubleshooting & Frequently Encountered Issues

| Symptom | Probable Cause | Quick Resolution Command |
| :--- | :--- | :--- |
| **Port 3000 already in use** | Stray Node.js process running | `Get-Process node \| Stop-Process -Force` (PowerShell) or `killall node` (Bash). |
| **Server shows "Offline / Degraded Mode"** | SQL Server local instance not started | Normal behavior for local offline viva demo; memoryStore fallback takes over automatically. |
| **Vite client build fails** | Missing dependency in `client/` | Run `npm --prefix client install && npm run build:client`. |
