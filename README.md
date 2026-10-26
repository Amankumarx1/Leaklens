# LeakLens — Authorized Data Exposure Detection & Response

[![Test Suite](https://img.shields.io/badge/tests-84%20passed-10b981.svg)]()
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-06b6d4.svg)]()
[![Backend](https://img.shields.io/badge/backend-Express%204%20%2B%20Node.js-38bdf8.svg)]()
[![Database](https://img.shields.io/badge/database-Azure%20SQL%20%2F%20MSSQL-0078d4.svg)]()
[![Cloud](https://img.shields.io/badge/cloud-Microsoft%20Azure-0078d4.svg)]()
[![Security](https://img.shields.io/badge/normalization-3NF%20Compliant-10b981.svg)]()
[![Phase](https://img.shields.io/badge/phase-4%20Azure%20Cloud%20Verified-blue.svg)]()

> **Defensive Cybersecurity Platform** designed to detect sensitive-data exposures (API keys, credentials, tokens, PII) in authorized repositories and files, mask findings, manage containment incidents, maintain tamper-resistant audit trails, and generate security analytics with native **Microsoft Azure** integration.

---

## 1. Project Overview & Phase 4 Architecture

LeakLens establishes a defensive cybersecurity posture for organizations by inspecting authorized files for accidental secret exposure and managing containment workflows through verified resolution.

**Phase 4 integrates the platform with Microsoft Azure and establishes production cloud readiness:**
```
[ Browser / Analyst ] ──(HTTPS)──> [ Azure App Service ] ──(Managed Identity)──> [ Azure Blob Storage (Private) ]
                                          │                                  ──> [ Azure Key Vault (Secrets) ]
                                          └──(Encrypted TDS / Transient Retry)──> [ Azure SQL Database (3NF) ]
```

### Core Cloud Capabilities
- **Single-Origin Production Hosting:** The Express backend serves the compiled React SPA directly from `client/dist` with `trust proxy` enabled for Azure reverse proxies, eliminating CORS vulnerabilities.
- **Private Azure Blob Storage:** Authorized files are stored in private container `leaklens-scans` (anonymous public access completely disabled) using non-reversible random paths: `scans/{scan_id}/{file_id}.bin`.
- **Compensating Failure Recovery:** Dual-phase failure rollback guarantees that if downstream parsing or SQL persistence fails, the uploaded storage blob is immediately deleted, preventing orphaned sensitive files.
- **Azure Key Vault & Managed Identity:** Zero secrets in source code. Runtime secrets (`SESSION_SECRET`, `JWT_SECRET`, `DB_PASSWORD`) are retrieved using `DefaultAzureCredential` with local in-memory caching and development fallback.
- **Azure SQL Hardening:** Enforces TLS encryption (`encrypt: true`), strict certificate validation in production (`trustServerCertificate: false`), connection pooling, and exponential backoff retry for transient failovers.
- **Cloud Probes:** Independent liveness probe (`GET /api/health`) and readiness probe (`GET /api/health/ready`) with complete redaction of internal credentials and hostnames.
- **Infrastructure as Code (IaC):** Modular Bicep template (`infra/azure/main.bicep`) with academic/free-tier cost sizing (Linux B1/F1, Azure SQL Basic 5 DTU, Storage LRS).

---

## 2. Technology Stack

- **Frontend:** React 19, Vite 8, Vanilla CSS design system (Dark navy `#080c14` with precision cyan `#06b6d4` accents, WCAG AA compliant).
- **Backend:** Node.js v20+ LTS with Express 4, ES Modules (`"type": "module"`), centralized fail-fast configuration.
- **Cloud Persistence:**
  - **Azure SQL Database / MSSQL:** 9 normalized 3NF tables, constraints, `vw_exposure_analytics`, and atomic stored procedure `sp_resolve_incident`.
  - **Azure Blob Storage:** Private object storage for authorized scans with non-reversible paths.
  - **Azure Key Vault:** Secret storage with Azure RBAC (`Key Vault Secrets User`).
- **Cloud Identity:** Microsoft Entra ID System-Assigned Managed Identity (`DefaultAzureCredential`).
- **Infrastructure as Code:** Azure Bicep templates (`infra/azure/`).
- **CI/CD:** GitHub Actions workflows (`.github/workflows/ci.yml` and `deploy.yml`) with OIDC federated credentials.
- **Testing & Static Analysis:** Vitest (84 tests passing across 13 suites), Supertest, Oxlint.

---

## 3. Role Permissions Matrix

Permissions are strictly enforced on backend API routes using `requireRole(...)`:

| Capability | ADMIN | ANALYST | COMPLIANCE_REVIEWER |
|---|:---:|:---:|:---:|
| View dashboard & metrics | ✅ Yes | ✅ Yes | ✅ Yes |
| Initiate file scan (`POST /api/scans`) | ✅ Yes | ✅ Yes | ❌ **Forbidden (403)** |
| View scans & findings | ✅ Yes | ✅ Yes | ✅ Yes |
| Create incident (`POST /api/incidents`) | ✅ Yes | ✅ Yes | ❌ **Forbidden (403)** |
| Assign incident (`PATCH /api/incidents/:id/assignment`) | ✅ Yes | ✅ Yes | ❌ **Forbidden (403)** |
| Log remediation action (`POST /api/incidents/:id/actions`) | ✅ Yes | ✅ Yes | ❌ **Forbidden (403)** |
| Record verification check (`POST /api/incidents/:id/verify`) | ✅ Yes | ✅ Yes | ❌ **Forbidden (403)** |
| Resolve incident (`POST /api/incidents/:id/resolve`) | ✅ Yes | ✅ Yes | ❌ **Forbidden (403)** |
| Reopen incident (`POST /api/incidents/:id/reopen`) | ✅ Yes | ✅ Yes (Resolved) / Admin (Closed) | ❌ **Forbidden (403)** |
| Access audit records (`GET /api/audit-logs`) | ✅ Yes | Read-only | Read-only |
| Manage account roles | ✅ Yes | ❌ No | ❌ No |

---

## 4. Repository Structure

```
Leaklens/
├── client/                     # Frontend Single Page Application (React + Vite)
│   ├── src/                    # Components, layouts, hooks, API service, styles
│   └── dist/                   # Production compiled assets (served via Express in prod)
├── server/                     # Backend API Application (Node.js + Express)
│   ├── src/
│   │   ├── config/             # Environment validation & Azure settings (env.js)
│   │   ├── controllers/        # auth, scan, finding, incident, analytics
│   │   ├── middleware/         # auth, errorHandler, requestLogger, fileUpload
│   │   ├── routes/             # auth, scans, findings, incidents, analytics, audit-logs, health
│   │   ├── services/
│   │   │   ├── scanner/        # scannerEngine, scannerService, maskingService, parsers, rules
│   │   │   ├── storage/        # blobStorageService (Azure Blob Storage + fallback)
│   │   │   ├── cloud/          # keyVaultService (Azure Key Vault + caching)
│   │   │   └── incidents/      # incidentService (lifecycle FSM, transitions, validations)
│   │   ├── repositories/       # Parameterized SQL DAOs with in-memory fallback
│   │   └── database/           # Connection pool manager with transient retry (connection.js)
├── database/                   # Relational Database Assets (SQL Server / Azure SQL)
│   ├── schema.sql              # 9 normalized 3NF tables, constraints, indexes
│   ├── views.sql               # vw_exposure_analytics view without count duplication
│   ├── procedures.sql          # sp_resolve_incident atomic transaction procedure
│   └── migrations/             # Idempotent forward migrations (001, 002, 003)
├── infra/                      # Infrastructure as Code & Deployment Automation
│   └── azure/
│       ├── main.bicep          # Bicep template (App Service, SQL, Storage, Key Vault, RBAC)
│       ├── parameters.json     # Parameter template (zero hardcoded secrets)
│       ├── deploy.ps1          # Automated deployment script for PowerShell
│       └── deploy.sh           # Automated deployment script for Bash
├── .github/workflows/          # CI/CD Pipelines
│   ├── ci.yml                  # Automated build, lint (Oxlint), and tests (Vitest)
│   └── deploy.yml              # Automated Azure App Service deployment via OIDC
├── docs/                       # Architecture & Security Documentation
│   ├── architecture.md         # System architecture & cloud topology
│   ├── azure-deployment.md     # Step-by-step Azure deployment manual
│   ├── azure-network-security.md # Cloud network paths, firewalls, and low-cost options
│   ├── cloud-security-checklist.md # Verified security controls checklist
│   └── master-prompt-4-cloud-implementation.md # Phase 4 implementation audit
└── tests/                      # Automated Vitest & Supertest Test Suites (84 tests)
    ├── cloud.integration.test.js # Phase 4 cloud probes, storage, Key Vault, and headers
    ├── incident.workflow.test.js # Phase 3 incident response lifecycle & verification
    ├── auth.rbac.test.js       # Authentication & role-based access control
    └── ...                     # Schema, upload, detection, health, and routing tests
```

---

## 5. Local Development Quickstart

```bash
# 1. Clone repository
git clone https://github.com/Amankumarx1/Leaklens.git
cd Leaklens

# 2. Install dependencies
npm run install:all

# 3. Configure environment
cp .env.example .env
# Edit .env with your local settings

# 4. Run automated test suites (84 tests across 13 suites)
npm test

# 5. Start development servers (frontend on :5173, backend on :3000)
npm run dev
```

Default local test credentials:
- **Admin:** `admin@leaklens.local` / `Admin@LeakLens2026!`
- **Analyst:** `analyst@leaklens.local` / `Analyst@LeakLens2026!`
- **Compliance:** `reviewer@leaklens.local` / `Reviewer@LeakLens2026!`

---

## 6. Cloud Deployment Instructions

See [docs/azure-deployment.md](docs/azure-deployment.md) for the complete cloud deployment guide.

To execute automated deployment using Azure CLI:
```powershell
# Windows PowerShell
.\infra\azure\deploy.ps1 -ResourceGroupName "rg-leaklens-prod" -Location "eastus"
```
```bash
# Linux / macOS Bash
./infra/azure/deploy.sh "rg-leaklens-prod" "eastus"
```

---

## 7. Operational Health Probes

- **Liveness Probe:** `GET /api/health` — Verifies Express process event loop, memory, and uptime.
- **Readiness Probe:** `GET /api/health/ready` — Validates Azure SQL Database, Azure Blob Storage, and Azure Key Vault connectivity without exposing credentials. Returns HTTP 200 when ready, HTTP 503 when dependencies are unreachable.

---

## 8. Verification & Test Summary

Run the comprehensive test suite locally:
```bash
npm test
```
All 13 test suites and 84 tests pass cleanly, covering:
- Database schema validation and constraints.
- Multi-format file upload validation (`.txt`, `.json`, `.csv`).
- Sensitive pattern detection engine and in-memory redaction.
- Private Azure Blob Storage provider, safe paths, and compensating failure cleanup.
- Azure Key Vault client caching and development fallback.
- Health and readiness probes with sensitive-data redaction.
- Strict Finite-State Machine incident management lifecycle.
- Role-based access control (`ADMIN`, `ANALYST`, `COMPLIANCE_REVIEWER`).
- Security headers (CSP, HSTS, X-Frame-Options) and reverse proxy trust.

---

## 9. Attributions & Credits

- **Core Technologies:** Node.js, Express, React, Vite, Microsoft SQL Server / Azure SQL, `@azure/storage-blob`, `@azure/identity`, `@azure/keyvault-secrets`.
- **Testing & Tooling:** Vitest, Supertest, Oxlint.
- **Security Guidance:** Microsoft Azure Well-Architected Framework, OWASP Top 10 API Security Risks, NIST SP 800-61 Rev. 2.
