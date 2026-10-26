# LeakLens — Authorized Data Exposure Detection & Response

[![Test Suite](https://img.shields.io/badge/tests-24%20passed-10b981.svg)]()
[![Frontend](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-06b6d4.svg)]()
[![Backend](https://img.shields.io/badge/backend-Express%204%20%2B%20Node.js-38bdf8.svg)]()
[![Database](https://img.shields.io/badge/database-Azure%20SQL%20%2F%20MSSQL-0078d4.svg)]()
[![Security](https://img.shields.io/badge/normalization-3NF%20Compliant-10b981.svg)]()

> **Defensive Cybersecurity Platform** designed to detect sensitive-data exposures (API keys, credentials, tokens, PII) in authorized repositories and files, mask findings, manage containment incidents, maintain tamper-resistant audit trails, and generate security analytics.

---

## 1. Project Overview

LeakLens establishes a defensive cybersecurity posture for organizations by inspecting authorized codebases and storage volumes for accidental secret exposure. The platform prioritizes:
- **Zero Secondary Exposure:** Detected secrets are cryptographically redacted before persistence (`masked_excerpt`), ensuring that security telemetry never becomes an exposure vector itself.
- **Relational Integrity (Third Normal Form):** Structured schema prevents phantom row multiplication and update anomalies across multi-tenant triage workflows.
- **Auditable Accountability:** Full traceability across scan initiation, analyst assignment, remediation actions (key rotation, revocation), and atomic resolution.

---

## 2. Technology Stack

- **Frontend:** React 19, Vite 8, Vanilla CSS design system (Dark navy `#080c14` with precision cyan `#06b6d4` accents, WCAG AA compliant).
- **Backend:** Node.js v24 LTS with Express 4, ES Modules (`"type": "module"`), centralized fail-fast configuration.
- **Database:** Microsoft SQL Server 2022+ / Azure SQL Database using `mssql` client with parameterized queries.
- **Architecture:** Modular Monolith with clean domain separation (`scanner`, `incidents`, `audit`).
- **Testing:** Vitest, Supertest, Oxlint.
- **Cloud Integrations (Phase 2/3 Roadmap):** Azure Blob Storage (private encrypted raw files) and Azure App Service.

---

## 3. Repository Structure

```
Leaklens/
├── client/                     # Frontend Single Page Application (React + Vite)
│   ├── src/
│   │   ├── components/         # Header, Sidebar, StatusBadge, EmptyState, etc.
│   │   ├── layouts/            # AppLayout shell
│   │   ├── pages/              # Dashboard, Scans, Findings, Incidents, Analytics, etc.
│   │   ├── services/           # Shared API client (api.js)
│   │   ├── hooks/              # useHealth hook
│   │   ├── App.jsx             # Shell state & routing
│   │   ├── main.jsx            # Entry point
│   │   └── index.css           # Cybersecurity design tokens & layout styles
│   ├── index.html              # Branded HTML shell
│   └── package.json
├── server/                     # Backend API Application (Node.js + Express)
│   ├── src/
│   │   ├── config/             # Centralized environment validation (env.js)
│   │   ├── controllers/        # Domain controllers (groundwork)
│   │   ├── middleware/         # errorHandler, notFoundHandler, requestLogger, validate
│   │   ├── routes/             # health.routes.js, index.js
│   │   ├── services/           # scanner/, incidents/, audit/ modular service layers
│   │   ├── repositories/       # Parameterized SQL data access objects
│   │   ├── database/           # Connection pool manager (connection.js)
│   │   ├── utils/              # apiResponse.js standardized formatters
│   │   ├── app.js              # Application factory
│   │   └── server.js           # Server listen & graceful shutdown lifecycle
│   ├── vitest.config.js
│   └── package.json
├── database/                   # Relational Database Assets (SQL Server / Azure SQL)
│   ├── schema.sql              # 9 normalized 3NF tables, constraints, indexes
│   ├── views.sql               # vw_exposure_analytics view without count duplication
│   ├── procedures.sql          # sp_resolve_incident atomic transaction procedure
│   ├── queries.sql             # Parameterized analytical & operational query examples
│   └── migrations/             # 001_initial_schema.sql baseline migration
├── docs/                       # Architecture & Technical Documentation
│   ├── initial-audit.md        # Initial state discovery and risk analysis
│   ├── architecture.md         # High-level architecture, C4 flow, and trade-offs
│   ├── data-dictionary.md      # Column specs, functional dependencies & 3NF proof
│   ├── er-diagram.mmd          # Valid Mermaid Entity-Relationship diagram
│   └── development-setup.md    # Local setup and Azure SQL guide
├── tests/                      # Automated Test Suite (24 tests)
│   ├── api.health.test.js      # Health endpoint response & secret leak prevention
│   ├── api.routing.test.js     # 404 handler and CORS verification
│   ├── config.validation.test.js # Fail-fast configuration testing
│   ├── database.schema.test.js # SQL 9-table schema & constraint verification
│   ├── error.handling.test.js  # Centralized error formatting
│   ├── frontend.rendering.test.js # Client shell structure & honest empty state check
│   └── security.secrets.test.js# Automated secret leak scanning across files
├── .env.example                # Safe environment configuration template
├── .gitignore                  # Git ignore rules for node_modules, .env, build output
├── package.json                # Root workspace orchestration
└── README.md                   # This project guide
```

---

## 4. Current Implementation Status (Phase 1 Baseline)

| Component | Status | Details |
|---|---|---|
| **Repository Audit** | ✅ Complete | Documented in `docs/initial-audit.md`. |
| **Backend Core** | ✅ Complete | Express application separated from startup, safe logging, CORS, error handling. |
| **Health API** | ✅ Complete | `GET /api/health` reports uptime, environment, and verifiable DB connectivity. |
| **Frontend Shell** | ✅ Complete | Responsive cybersecurity UI, branded sidebar, honest empty state. |
| **Relational Database** | ✅ Complete | 9 normalized tables (3NF), check constraints, foreign keys, indexes in `database/schema.sql`. |
| **Analytics View** | ✅ Complete | `vw_exposure_analytics` prevents duplicate row counting across joins. |
| **Stored Procedure** | ✅ Complete | `sp_resolve_incident` executes atomic incident resolution, remediation, and audit trail logging. |
| **Automated Testing** | ✅ Complete | 24 passing tests covering API, schema, security, and UI. |
| **Scanner Engine** | ⏳ Phase 2 | Planned for Phase 2: pattern regex heuristics, streaming file parsing, Azure Blob integration. |
| **Incident Response Workflow** | ⏳ Phase 2/3 | Planned for Phase 2/3: interactive triage, analyst assignment queues. |
| **Power BI Reporting** | ⏳ Phase 3 | Planned for Phase 3: DirectQuery analytics dashboard. |

---

## 5. Development Setup & Execution

### Prerequisites
- Node.js v20+ LTS or v24+
- npm v10+ or v11+
- Git

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
```
*(On Windows PowerShell: `Copy-Item .env.example .env`)*

Configure your database credentials inside `.env`. During local development when a live SQL Server is not connected, the server automatically starts in graceful offline/degraded mode.

### 3. Start Development Servers
**Start Backend Server:**
```bash
npm run dev:server
# Server runs on http://localhost:3000
# Health endpoint: http://localhost:3000/api/health
```

**Start Frontend Client (Separate Terminal):**
```bash
npm run dev:client
# Client runs on http://localhost:5173
```

---

## 6. Testing & Validation Commands

Execute all automated tests:
```bash
npm test
```

Execute frontend linter (Oxlint):
```bash
npm run lint:client
```

Verify frontend production build:
```bash
npm run build:client
```

---

## 7. Security Considerations

1. **Parameterization:** All database operations strictly use parameterized queries (`mssql`) to prevent SQL injection.
2. **Secret Redaction:** `server/src/middleware/requestLogger.js` redacts `authorization`, `cookie`, `token`, and `password` fields from console and file logs.
3. **Transport Security:** `DB_ENCRYPT=true` is enforced. In production (`NODE_ENV=production`), `DB_TRUST_SERVER_CERTIFICATE=false` is enforced to prevent man-in-the-middle attacks.
4. **Least-Privilege Principles:** Database operations do not require `sysadmin` or `sa` credentials; a dedicated `leaklens_app` user with DDL-restricted permissions is documented.

---

## 8. Credits & Acknowledgements

- **Design & Architecture:** Developed as part of the LeakLens Authorized Data Exposure Detection & Response platform.
- **Frontend Engine:** [React](https://react.dev/) & [Vite](https://vitejs.dev/).
- **Backend Framework:** [Express.js](https://expressjs.com/).
- **Database Engine:** [Microsoft SQL Server](https://www.microsoft.com/sql-server) & [`mssql`](https://www.npmjs.com/package/mssql).
- **Test Frameworks:** [Vitest](https://vitest.dev/) & [Supertest](https://github.com/ladjs/supertest).
- **Static Analysis:** [Oxlint](https://oxc-project.github.io/).
- **Engineering Assistance:** Implemented with paired AI assistance from Antigravity (Google DeepMind).
