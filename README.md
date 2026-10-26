# LeakLens — Authorized Data Exposure Detection & Response

[![Test Suite](https://img.shields.io/badge/tests-67%20passed-10b981.svg)]()
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-06b6d4.svg)]()
[![Backend](https://img.shields.io/badge/backend-Express%204%20%2B%20Node.js-38bdf8.svg)]()
[![Database](https://img.shields.io/badge/database-Azure%20SQL%20%2F%20MSSQL-0078d4.svg)]()
[![Security](https://img.shields.io/badge/normalization-3NF%20Compliant-10b981.svg)]()
[![Phase](https://img.shields.io/badge/phase-3%20Incident%20Response%20Verified-blue.svg)]()

> **Defensive Cybersecurity Platform** designed to detect sensitive-data exposures (API keys, credentials, tokens, PII) in authorized repositories and files, mask findings, manage containment incidents, maintain tamper-resistant audit trails, and generate security analytics.

---

## 1. Project Overview & Phase 3 Capabilities

LeakLens establishes a defensive cybersecurity posture for organizations by inspecting authorized files for accidental secret exposure and managing containment workflows through resolution.

**Phase 3 completes the comprehensive incident response and remediation subsystem:**
```
Detected Finding ➔ Incident Escalation ➔ Finding Association ➔ Analyst Assignment 
  ➔ Investigation Notes ➔ Remediation Actions ➔ Independent Verification Check 
  ➔ Transactional Resolution (sp_resolve_incident) ➔ Audit Trails & Analytics
```

### Key Pillars
- **Strict Finite-State Machine (FSM):** Incident status transitions strictly enforced (`OPEN` $\to$ `IN_PROGRESS` $\to$ `PENDING_VERIFICATION` $\to$ `RESOLVED` $\to$ `CLOSED`).
- **Atomic Incident Resolution (`sp_resolve_incident`):** Stored procedure executing incident status change, finding remediation status update, remediation action recording, and audit trail generation within an atomic database transaction.
- **Optimistic Concurrency Control:** Version-token validation (`version INT`) prevents conflicting concurrent updates across security operations center (SOC) analysts.
- **Zero Secondary Exposure:** Matched secrets are masked in-memory before entering persistent finding records or logs. Plaintext secrets are never stored.
- **Auditable Accountability:** Full traceability across user authentication, scan executions, rule evaluations, assignments, remediation actions, and resolutions.

---

## 2. Technology Stack

- **Frontend:** React 19, Vite 8, Vanilla CSS design system (Dark navy `#080c14` with precision cyan `#06b6d4` accents, WCAG AA compliant).
- **Backend:** Node.js v20+ / v24+ LTS with Express 4, ES Modules (`"type": "module"`), centralized fail-fast configuration.
- **Database:** Microsoft SQL Server 2022+ / Azure SQL Database using `mssql` client with parameterized queries and transactional atomicity. (Includes an automated in-memory repository store for local offline testing).
- **Architecture:** Modular Monolith with clean domain separation (`scanner/`, `parsers/`, `rules/`, `incidents/`, `repositories/`).
- **Testing & Static Analysis:** Vitest, Supertest, Oxlint.

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
│   ├── src/
│   │   ├── components/         # Header, Sidebar, FindingDetailModal, StatusBadge, etc.
│   │   ├── layouts/            # AppLayout authenticated shell
│   │   ├── pages/              # Dashboard, Scans, NewScan, ScanDetail, Findings,
│   │   │                       # IncidentsPage, NewIncidentPage, IncidentDetailPage, AuditLogs, Settings
│   │   ├── services/           # API client with Cookie/JWT handling (api.js)
│   │   ├── hooks/              # useHealth hook
│   │   ├── App.jsx             # Shell state & client-side routing
│   │   └── index.css           # Cybersecurity design tokens & layout styles
│   └── package.json
├── server/                     # Backend API Application (Node.js + Express)
│   ├── src/
│   │   ├── config/             # Centralized environment validation (env.js)
│   │   ├── controllers/        # auth, scan, finding, incident, analytics
│   │   ├── middleware/         # auth (JWT/Cookie + RBAC), errorHandler, requestLogger, validate
│   │   ├── routes/             # auth, scans, findings, incidents, analytics, audit-logs, health
│   │   ├── services/
│   │   │   ├── scanner/        # scannerEngine, scannerService, maskingService, parsers, rules
│   │   │   └── incidents/      # incidentService (lifecycle FSM, transitions, validations)
│   │   ├── repositories/       # Parameterized SQL DAOs with in-memory fallback
│   │   │   ├── incidentRepository.js # Dual-mode incident persistence & transaction handling
│   │   │   ├── findingRepository.js
│   │   │   ├── scanRepository.js
│   │   │   ├── userRepository.js
│   │   │   └── memoryStore.js  # Offline persistent store for tests/offline development
│   │   ├── database/           # Connection pool manager (connection.js)
│   │   └── app.js              # Application factory with cookie & CORS middleware
│   └── package.json
├── database/                   # Relational Database Assets (SQL Server / Azure SQL)
│   ├── schema.sql              # 9 normalized 3NF tables, constraints, indexes
│   ├── views.sql               # vw_exposure_analytics view without count duplication
│   ├── procedures.sql          # sp_resolve_incident atomic transaction procedure
│   ├── queries.sql             # Parameterized queries for scans, findings, incidents, and audit
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_phase2_roles_and_rules.sql
│       └── 003_phase3_incident_remediation.sql # Phase 3 incident columns & constraints
├── docs/                       # Architecture & Technical Documentation
│   ├── initial-audit.md        # Initial state discovery and risk analysis
│   ├── architecture.md         # High-level architecture and workflow flowcharts
│   ├── scanner-design.md       # Scanner engine, parser, rule, and masking specs
│   ├── incident-lifecycle.md   # State transitions, FSM, permissions, and verification rules
│   ├── incident-response-design.md # Incident domain model, sp_resolve_incident, and concurrency
│   ├── master-prompt-2-implementation.md # Phase 2 implementation audit and report
│   ├── master-prompt-3-implementation.md # Phase 3 implementation audit and report
│   └── data-dictionary.md      # Column specs, functional dependencies & 3NF proof
├── scripts/
│   └── seed.js                 # Controlled development seed script (hashes passwords)
├── tests/                      # Automated Test Suite (67 tests across 12 suites)
│   ├── incident.workflow.test.js # Creation, assignment, transitions, remediation, verification, resolution
│   ├── auth.rbac.test.js       # Auth tokens, login, logout, and role matrix tests
│   ├── scanner.detection.test.js # Regex parsing, rules, severities, and masking tests
│   ├── scanner.upload.test.js  # Format validation, size limit, binary detection tests
│   ├── scan.persistence.test.js# Scan execution, persistence, and audit log tests
│   ├── api.health.test.js      # Health endpoint response & DB connectivity
│   ├── api.routing.test.js     # 404 handler and route verification
│   ├── config.validation.test.js # Fail-fast configuration testing
│   ├── database.schema.test.js # SQL 9-table schema & constraint verification
│   ├── error.handling.test.js  # Centralized error formatting
│   ├── frontend.rendering.test.js # Client UI rendering, pages, and route tests
│   └── security.secrets.test.js# Automated secret leak scanning across repo
└── README.md                   # This project guide
```

---

## 5. Development Setup & Execution

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
# Windows PowerShell: Copy-Item .env.example .env
```

### 3. Initialize Database Schema & Seed Accounts
If connecting to Microsoft SQL Server / Azure SQL:
```bash
sqlcmd -S localhost -d leaklens_db -i database/schema.sql
sqlcmd -S localhost -d leaklens_db -i database/migrations/002_phase2_roles_and_rules.sql
sqlcmd -S localhost -d leaklens_db -i database/migrations/003_phase3_incident_remediation.sql
```

Provision default development accounts:
```bash
node scripts/seed.js
```

#### Pre-provisioned Development Accounts:
| Role | Email | Password | Permissions |
|---|---|---|:---:|
| **Analyst** | `analyst@leaklens.local` | `LeakLensDev2026!` | Can scan, create & triage incidents, resolve |
| **Admin** | `admin@leaklens.local` | `LeakLensDev2026!` | Full administrative capabilities |
| **Compliance Reviewer** | `compliance@leaklens.local` | `LeakLensDev2026!` | Read-only inspection & audit view |

---

## 6. Running the Application

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

## 7. Step-by-Step Procedure: Demonstrating One Complete Incident Workflow

1. **Sign In as Analyst:** Open `http://localhost:5173/login`, click **Quick Fill: Analyst**, and click **Sign In**.
2. **Scan a File:** Navigate to **+ Scan File** (`/scans/new`), upload a sample file containing credentials (e.g. `billing.json` containing `ghp_SampleToken1234567890`), and run the scan.
3. **Escalate to Incident:**
   - Go to **Findings** (`/findings`), locate the newly detected finding, and click **Escalate** (or inspect finding and click **Escalate to Incident**).
   - On the **Create Security Incident** page, enter a title (e.g., `GitHub Token Compromise in Billing API`), select Priority (`CRITICAL`), enter a safe description, verify the finding checkbox is selected, and click **Create Incident & Associate Findings**.
4. **Assign the Incident:**
   - In the Incident Workspace (`/incidents/:id`), locate the **Current Assignee** selector in the overview card.
   - Select `Lead Security Analyst (ANALYST)` and click **Save**.
   - Observe the assignment recorded in the activity timeline.
5. **Start Investigation:**
   - Click the **Start Investigation** button. Status transitions to `IN_PROGRESS`.
   - In the **Record Remediation Action** form, select `Remediation / Key Rotation`, enter notes (e.g. `Revoked token ghp_... in GitHub developer settings; rotated repository secrets`), and click **Log Remediation Action**.
6. **Request Verification:**
   - Click the **Request Verification** button. Status transitions to `PENDING_VERIFICATION`.
7. **Perform Verification Check:**
   - Click **Record Verification Check**. Select Outcome `PASSED`, enter verification summary (e.g. `Queried GitHub API using old token; confirmed HTTP 401 Unauthorized`), and submit.
8. **Execute Transactional Resolution (`sp_resolve_incident`):**
   - Click **Resolve Incident** (or **Confirm Resolution**).
   - Enter a comprehensive resolution summary (e.g. `Token revoked and rotated. Git history rewritten via git-filter-repo. Verified zero subsequent unauthorized calls`).
   - Click **Commit Atomic Resolution**.
   - Observe that the incident status immediately transitions to `RESOLVED`, all linked findings are marked `remediated`, and the resolution event is recorded in the immutable activity timeline.
9. **Verify RBAC Restrictions:** Sign out, log in as `compliance@leaklens.local`, and navigate to `/incidents`. Note that compliance reviewers can inspect tickets and audit trails in read-only mode, with all mutation controls securely disabled.

---

## 8. Testing & Static Analysis

Execute all 67 automated tests:
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

## 9. Security Considerations

1. **In-Memory Masking:** Redaction occurs directly within `maskingService.js` in memory before database record creation.
2. **Strict Parameterization:** All SQL database queries use parameterized parameters via the `mssql` client.
3. **Atomic State Progression:** Resolution updates incident status, marks findings remediated, and logs audit events within a single atomic SQL transaction.
4. **Optimistic Concurrency:** Version tokens prevent lost updates from concurrent analyst operations.
5. **Private Key Body Protection:** PEM private key bodies are immediately dropped from memory and never returned in API responses or logs.

---

## 10. Credits & Acknowledgements

- **Design & Architecture:** Developed as part of the LeakLens Authorized Data Exposure Detection & Response platform.
- **Engineering Assistance:** Paired full-stack implementation with Antigravity (Google DeepMind).
