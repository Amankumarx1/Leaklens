# LeakLens — Authorized Data Exposure Detection & Response

[![Test Suite](https://img.shields.io/badge/tests-55%20passed-10b981.svg)]()
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-06b6d4.svg)]()
[![Backend](https://img.shields.io/badge/backend-Express%204%20%2B%20Node.js-38bdf8.svg)]()
[![Database](https://img.shields.io/badge/database-Azure%20SQL%20%2F%20MSSQL-0078d4.svg)]()
[![Security](https://img.shields.io/badge/normalization-3NF%20Compliant-10b981.svg)]()
[![Phase](https://img.shields.io/badge/phase-2%20End--to--End%20Verified-blue.svg)]()

> **Defensive Cybersecurity Platform** designed to detect sensitive-data exposures (API keys, credentials, tokens, PII) in authorized repositories and files, mask findings, manage containment incidents, maintain tamper-resistant audit trails, and generate security analytics.

---

## 1. Project Overview & Phase 2 Capabilities

LeakLens establishes a defensive cybersecurity posture for organizations by inspecting authorized files for accidental secret exposure.

**Phase 2 marks the completion of the application's first complete, working end-to-end workflow:**
```
User Login (RBAC) ➔ Authorized File Upload (.txt, .json, .csv) ➔ Input Validation 
  ➔ Sensitive-Data Detection ➔ Severity Classification ➔ Safe Masking 
  ➔ Relational SQL Persistence (with in-memory fallback) ➔ Findings Dashboard
```

### Key Pillars
- **Strict Role-Based Access Control (RBAC):** Backend-enforced permissions for `ADMIN`, `ANALYST`, and `COMPLIANCE_REVIEWER`.
- **Zero Secondary Exposure:** Matched secrets are masked in-memory before entering persistent finding records or logs. Plaintext secrets are never stored.
- **Relational Integrity (Third Normal Form):** Structured schema prevents phantom row multiplication and maintains relationships between users, scan jobs, files, rules, and findings.
- **Auditable Accountability:** Full traceability across user authentication, scan executions, rule evaluations, and system events.

---

## 2. Technology Stack

- **Frontend:** React 19, Vite 8, Vanilla CSS design system (Dark navy `#080c14` with precision cyan `#06b6d4` accents, WCAG AA compliant).
- **Backend:** Node.js v20+ / v24+ LTS with Express 4, ES Modules (`"type": "module"`), centralized fail-fast configuration.
- **Database:** Microsoft SQL Server 2022+ / Azure SQL Database using `mssql` client with parameterized queries and transactional atomicity. (Includes an automated in-memory repository store for local offline testing).
- **Architecture:** Modular Monolith with clean domain separation (`scanner/`, `parsers/`, `rules/`, `repositories/`).
- **Testing & Static Analysis:** Vitest, Supertest, Oxlint.

---

## 3. Repository Structure

```
Leaklens/
├── client/                     # Frontend Single Page Application (React + Vite)
│   ├── src/
│   │   ├── components/         # Header, Sidebar, FindingDetailModal, StatusBadge, etc.
│   │   ├── layouts/            # AppLayout authenticated shell
│   │   ├── pages/              # LoginPage, DashboardPage, NewScanPage, ScansPage, ScanDetailPage, FindingsPage
│   │   ├── services/           # API client with Cookie/JWT handling (api.js)
│   │   ├── hooks/              # useHealth hook
│   │   ├── App.jsx             # Session management & client-side routing
│   │   └── index.css           # Cybersecurity design tokens & layout styles
│   └── package.json
├── server/                     # Backend API Application (Node.js + Express)
│   ├── src/
│   │   ├── config/             # Centralized environment validation (env.js)
│   │   ├── controllers/        # authController, scanController, findingController, analyticsController
│   │   ├── middleware/         # auth (JWT/Cookie + RBAC), errorHandler, requestLogger, validate
│   │   ├── routes/             # auth, scans, findings, analytics, audit-logs, health
│   │   ├── services/scanner/   # scannerEngine, scannerService, maskingService, parsers, rules
│   │   │   ├── parsers/        # textParser, jsonParser, csvParser, parserFactory
│   │   │   └── rules/          # ruleDefinitions (EMAIL, API_KEY, PRIVATE_KEY, SENSITIVE_ID)
│   │   ├── repositories/       # Parameterized SQL DAOs with in-memory fallback
│   │   │   └── memoryStore.js  # Offline persistent store for tests/offline development
│   │   ├── database/           # Connection pool manager (connection.js)
│   │   ├── utils/              # apiResponse standardized formatters
│   │   └── app.js              # Application factory with cookie & CORS middleware
│   └── package.json
├── database/                   # Relational Database Assets (SQL Server / Azure SQL)
│   ├── schema.sql              # 9 normalized 3NF tables, constraints, indexes
│   ├── views.sql               # vw_exposure_analytics view without count duplication
│   ├── procedures.sql          # sp_resolve_incident atomic transaction procedure
│   └── migrations/
│       ├── 001_initial_schema.sql
│       └── 002_phase2_roles_and_rules.sql # Phase 2 roles and detection rules seed
├── docs/                       # Architecture & Technical Documentation
│   ├── initial-audit.md        # Initial state discovery and risk analysis
│   ├── architecture.md         # Architecture and Phase 2 workflow documentation
│   ├── scanner-design.md       # Scanner engine, parser, rule, and masking specs
│   ├── master-prompt-2-implementation.md # Phase 2 implementation and verification report
│   └── data-dictionary.md      # Column specs, functional dependencies & 3NF proof
├── scripts/
│   └── seed.js                 # Controlled development seed script (hashes passwords)
├── tests/                      # Automated Test Suite (55 tests across 11 suites)
│   ├── auth.rbac.test.js       # Auth tokens, login, logout, and role matrix tests
│   ├── scanner.detection.test.js # Regex parsing, rules, severities, and masking tests
│   ├── scanner.upload.test.js  # Format validation, size limit, binary detection tests
│   ├── scan.persistence.test.js# Scan execution, persistence, and audit log tests
│   ├── api.health.test.js      # Health endpoint response & DB connectivity
│   ├── api.routing.test.js     # 404 handler and route verification
│   ├── config.validation.test.js # Fail-fast configuration testing
│   ├── database.schema.test.js # SQL 9-table schema & constraint verification
│   ├── error.handling.test.js  # Centralized error formatting
│   ├── frontend.rendering.test.js # Client UI rendering and modal tests
│   └── security.secrets.test.js# Automated secret leak scanning across repo
├── .env.example                # Safe environment configuration template
└── README.md                   # This project guide
```

---

## 4. Role Permissions Matrix

Permissions are strictly enforced on backend API routes using `requireRole(...)`:

| Capability | ADMIN | ANALYST | COMPLIANCE_REVIEWER |
|---|:---:|:---:|:---:|
| View dashboard & metrics | ✅ Yes | ✅ Yes | ✅ Yes |
| Initiate file scan (`POST /api/scans`) | ✅ Yes | ✅ Yes | ❌ **Forbidden (403)** |
| View scans & findings (`GET /api/scans`, `GET /api/findings`) | ✅ Yes | ✅ Yes | ✅ Yes |
| Access audit records (`GET /api/audit-logs`) | ✅ Yes | Read-only | Read-only |
| Manage account roles | ✅ Yes | ❌ No | ❌ No |
| Access application settings | ✅ Yes | ❌ No | ❌ No |

---

## 5. Supported File Formats & Scanner Rules

### Supported File Formats
- **Plain Text (`.txt`)**: Processed line-by-line (`line:N`).
- **JSON (`.json`)**: Validated and flattened via JSONPath notation (`$.field[idx].key`).
- **CSV (`.csv`)**: Validated and mapped by row and column header (`row:N,col:Header`).
- **Upload Limit:** Configurable default of **5 MB** (`MAX_FILE_SIZE_BYTES=5242880`).
- **Safety Controls:** Non-text binary files (null-byte inspection `0x00`), malformed JSON, and disallowed extensions (`.exe`, `.pdf`, `.zip`, etc.) are rejected with HTTP 400/415.

### Detection Rules & Masking Formats
| Rule ID | Category | Severity | Pattern / Target | Safe Masking Strategy |
|---|---|---|---|---|
| `EMAIL_ADDRESS_RULE` | `EMAIL_ADDRESS` | `LOW` | RFC 5322 email patterns | `a***e@example.com` |
| `API_KEY_CANDIDATE_RULE` | `API_KEY_CANDIDATE` | `HIGH` | Prefix-based keys (`AKIA...`, `ghp_...`, `eyJ...`) | `ghp_***_9X2` |
| `PRIVATE_KEY_MARKER_RULE` | `PRIVATE_KEY_MARKER` | `CRITICAL` | PEM private key header markers | `[MASKED PRIVATE KEY BLOCK]` *(body discarded)* |
| `SENSITIVE_IDENTIFIER_RULE` | `SENSITIVE_IDENTIFIER` | `HIGH` | Internal sensitive IDs (`LL-ID-[A-Z0-9]{8,12}`) | `LL-ID-***-3F9A` |

---

## 6. Development Setup & Execution

### Prerequisites
- **Node.js**: v20+ LTS or v24+
- **npm**: v10+ or v11+
- **Git**

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/Amankumarx1/Leaklens.git
cd Leaklens
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
# Windows PowerShell:
# Copy-Item .env.example .env
```

Review and adjust settings in `.env` as needed:
```ini
NODE_ENV=development
PORT=3000
JWT_SECRET=development-jwt-secret-do-not-use-in-production-must-be-32-chars-long
JWT_EXPIRES_IN=8h
MAX_FILE_SIZE_BYTES=5242880

# Database Configuration (Optional for local offline development; memoryStore is used if offline)
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=leaklens_db
DB_USER=leaklens_app
DB_PASSWORD=YourStrongPassword123!
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true
```

### 3. Initialize Database Schema & Provision Test Accounts
If connecting to Microsoft SQL Server / Azure SQL:
```bash
# Apply baseline schema and Phase 2 migration:
sqlcmd -S localhost -d leaklens_db -i database/schema.sql
sqlcmd -S localhost -d leaklens_db -i database/migrations/002_phase2_roles_and_rules.sql
```

Run the controlled development seed script to provision test accounts with bcrypt password hashes:
```bash
node scripts/seed.js
```

#### Pre-provisioned Development Accounts:
| Role | Email | Password | Allowed to Scan? |
|---|---|---|:---:|
| **Analyst** | `analyst@leaklens.local` | `LeakLensDev2026!` | ✅ Yes |
| **Admin** | `admin@leaklens.local` | `LeakLensDev2026!` | ✅ Yes |
| **Compliance Reviewer** | `compliance@leaklens.local` | `LeakLensDev2026!` | ❌ No (Read-Only) |

---

## 7. Running the Application

### Start Backend Server:
```bash
npm run dev:server
# Server runs on http://localhost:3000
# Health check: http://localhost:3000/api/health
```

### Start Frontend Client (Separate Terminal):
```bash
npm run dev:client
# Frontend runs on http://localhost:5173
```

---

## 8. Reproducible Procedure: Demonstrating One Complete Scan

1. **Access Login:** Open `http://localhost:5173/login` in your browser.
2. **Authenticate:** Click the **Quick Fill: Analyst** button (or sign in as `analyst@leaklens.local` / `LeakLensDev2026!`). Click **Sign In**.
3. **Navigate to Upload:** In the sidebar, select **New Scan** (or navigate to `/scans/new`).
4. **Prepare a Synthetic Test File:** Create a test file `test-scan.json`:
   ```json
   {
     "service": "billing-pipeline",
     "owner": "dev-team@internal.corp",
     "api_token": "ghp_TestSecretTokenForAudit1234567890",
     "account_id": "LL-ID-88392019"
   }
   ```
5. **Upload & Scan:** Drag and drop `test-scan.json` into the upload zone and click **Run Security Scan**.
6. **Verify Result Summary:** A scan completion banner appears displaying the generated Scan ID and total findings detected.
7. **Inspect in Findings Dashboard:**
   - Click **View Scan Results** to open `/scans/:id` and review the detected items with line/JSONPath locations.
   - Click **Inspect** on any finding to verify that the secret is securely masked (e.g. `ghp_***_890`).
   - Navigate to **Findings** in the sidebar to test filtering by Severity (`HIGH`, `LOW`) and Category.
   - Navigate to **Dashboard** to verify updated metrics across scans, severity breakdown, and category distribution.
8. **Verify Compliance Restrictions:** Log out and log back in as `compliance@leaklens.local`. Navigate to `/scans/new` and observe that scan initiation is disabled with an explanatory permission warning.

---

## 9. Testing & Static Analysis

Execute all 55 automated tests:
```bash
npm test
```

Execute frontend linting (Oxlint):
```bash
npm run lint:client
```

Verify frontend production build:
```bash
npm run build:client
```

---

## 10. Security Considerations

1. **In-Memory Masking:** Redaction occurs directly within `maskingService.js` in memory before database record creation.
2. **Strict Parameterization:** All SQL database queries use parameterized parameters via the `mssql` client.
3. **No Usable Production Secrets:** Seed passwords and secrets in `.env.example` are synthetic placeholders restricted from production environments.
4. **Least-Privilege RBAC:** Enforced via backend middleware rather than purely relying on UI state.
5. **Private Key Body Protection:** PEM private key bodies are immediately dropped from memory and never returned in API responses or logs.

---

## 11. Current Limitations & Roadmap

- **Storage:** Scanned files are parsed directly in memory and immediately discarded. Phase 4 will introduce private Azure Blob Storage for long-term encrypted retention.
- **Scanning Mode:** Synchronous scanning is implemented for this phase (ideal for files up to 5 MB). Asynchronous worker queues will be introduced in subsequent phases for large-scale archive processing.
- **Incident Management:** Incident triage, status transitions, and key rotation workflows will be delivered in Phase 3.

---

## 12. Credits & Acknowledgements

- **Design & Architecture:** Developed as part of the LeakLens Authorized Data Exposure Detection & Response platform.
- **Engineering Assistance:** Paired full-stack implementation with Antigravity (Google DeepMind).
