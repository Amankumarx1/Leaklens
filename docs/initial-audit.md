# LeakLens Phase 1 — Initial Repository Audit

**Date:** 2026-10-26  
**Auditor:** Senior Full-Stack & Application Security Engineer  
**Repository:** `Amankumarx1/Leaklens`  
**Target Platform:** LeakLens — Authorized Data Exposure Detection & Response  

---

## 1. Existing Project Structure

Upon initial inspection prior to any modifications, the local workspace directory was cloned directly from the newly created GitHub repository:
- **Repository URL:** `https://github.com/Amankumarx1/Leaklens`
- **Initial Directory Tree:**
  ```
  Leaklens/
  └── .git/
  ```
- **Legacy Files Present:** None (clean repository slate).
- **Existing Build/Configuration Files:** None.

---

## 2. Current Technology Stack

- **Operating System Environment:** Windows (x64)
- **Node.js Runtime:** v24.19.0
- **Package Manager:** npm v11.17.0
- **Version Control:** git v2.55.0 / GitHub CLI v2.98.0
- **Target Backend Architecture:** Node.js (v20+ LTS / v24) with Express.js, ES Modules (`import/export`)
- **Target Frontend Architecture:** React 18 / 19 with Vite, Vanilla CSS design system
- **Target Database Architecture:** Microsoft SQL Server / Azure SQL Database using `mssql` client with parameterized queries

---

## 3. Existing Functionality

- **Baseline Codebase:** Clean slate. No legacy code, business logic, routes, or frontend components existed prior to Phase 1 initialization.
- **Git Repository:** Successfully initialized and linked to the authenticated GitHub remote `https://github.com/Amankumarx1/Leaklens`.

---

## 4. Missing Components (Phase 1 Baseline Requirements)

To fulfill the Phase 1 Foundation & Database Architecture requirements, the following components must be designed and implemented:

1. **Project Infrastructure & Root Orchestration:**
   - Root `package.json` with workspace orchestration scripts (`dev`, `build`, `test`, `lint`).
   - Standard `.gitignore` preventing commit of `.env`, `node_modules`, build outputs, test coverage, and temporary artifacts.
   - Comprehensive `.env.example` documenting all configuration keys without secrets.

2. **Backend Foundation (`server/`):**
   - Separation of application definition (`src/app.js`) from server lifecycle management (`src/server.js`).
   - Centralized environment parsing and schema validation (`src/config/env.js`) with fail-fast behavior on missing critical settings.
   - Centralized error handling middleware (`src/middleware/errorHandler.js`) and 404 route handling (`src/middleware/notFoundHandler.js`).
   - Safe HTTP request logging (`src/middleware/requestLogger.js`) strictly redacting sensitive tokens, passwords, cookies, and authorization headers.
   - Consistent API response formatting helper (`src/utils/apiResponse.js`).
   - Microsoft SQL Server connection pool module (`src/database/connection.js`) using parameterized query helpers, TLS enforcement, and graceful degradation when offline.
   - Operational health check endpoint at `GET /api/health` providing live uptime, environment, and verifiable database connectivity verification.
   - Strict CORS configuration and JSON payload size limits.

3. **Frontend Application Shell (`client/`):**
   - React + Vite foundation with zero unnecessary heavy dependencies.
   - Professional cybersecurity design system (dark navy `#0a0f1d`, slate `#0f172a`, and cyan `#06b6d4` accents; accessible contrast; clean typography).
   - Core application shell with branded header, status pill, and responsive navigation sidebar.
   - Dashboard landing page featuring honest empty states (no fabricated security metrics or phantom scan results).
   - Dedicated placeholder views for Scans, Findings, Incidents, Analytics, Audit Logs, and Settings clearly signaling upcoming Phase 2/3 capabilities.
   - Shared API client configured via environment variable (`VITE_API_URL`).

4. **Relational Database Architecture (`database/`):**
   - 9 normalized tables conforming to Third Normal Form (3NF):
     - `users`
     - `scan_jobs`
     - `files`
     - `detection_rules`
     - `findings`
     - `incidents`
     - `incident_findings` (junction table)
     - `remediation_actions`
     - `audit_logs`
   - Primary keys, foreign key constraints with explicit referential integrity, check constraints, unique constraints, and optimized indexes.
   - Data definition scripts: `schema.sql`, `views.sql` (`vw_exposure_analytics`), `procedures.sql` (`sp_resolve_incident`), and `queries.sql`.

5. **Documentation & Architecture Specifications (`docs/`):**
   - `initial-audit.md` (this document).
   - `data-dictionary.md` (comprehensive 3NF proof, column specifications, functional dependencies).
   - `er-diagram.mmd` (Mermaid Entity-Relationship diagram).
   - `architecture.md` (modular monolith trade-off, scanning pipeline, security boundaries, and C4/flow diagrams).
   - `development-setup.md` (local dev guide, Azure SQL connectivity, and execution instructions).

6. **Automated Test Suite (`tests/`):**
   - Health endpoint verification.
   - 404 unknown route handler verification.
   - Centralized error handler verification.
   - Environment validation and fail-fast verification.
   - Secret leak prevention and configuration check.
   - SQL schema syntax and structure integrity check.

---

## 5. Identified Risks & Security Considerations

| Risk Category | Description | Mitigation Strategy in Phase 1 |
|---|---|---|
| **Secret Leakage in Git** | Accidental commit of `.env` or credentials. | Add strict `.gitignore` patterns; write `.env.example` with blank placeholders only; add automated test scanning for secrets. |
| **SQL Injection** | Dynamic SQL string concatenation. | Use parameterized queries exclusively via the `mssql` client abstraction layer. |
| **Information Disclosure in Health Checks** | Revealing connection strings, server IPs, or stack traces in `GET /api/health`. | Return only high-level operational status (`status: "healthy" | "degraded"`, `database: "connected" | "disconnected"`); sanitize all error outputs. |
| **Log Injection & Secret Logging** | Sensitive tokens, file contents, or authorization headers dumped to console. | Custom logging middleware filtering headers (`authorization`, `cookie`) and sanitizing request bodies. |
| **False Health Status** | Claiming database is healthy without an active ping. | Perform real `SELECT 1 AS is_alive` query against SQL Server; mark database as `disconnected` if query fails. |
| **Production Certificate Invalidation** | Disabling TLS verification in production. | Enforce `encrypt: true` and `trustServerCertificate: false` when `NODE_ENV === 'production'`. |

---

## 6. Phase 1 Implementation Roadmap

1. Establish directory layout (`client/`, `server/`, `database/`, `docs/`, `tests/`).
2. Scaffold root `package.json` and configure workspaces / scripts.
3. Build Express server foundation with security middleware, config validation, and `GET /api/health`.
4. Scaffold React + Vite client with branded cybersecurity application shell, sidebar, and placeholder routes.
5. Author SQL DDL (`schema.sql`, `views.sql`, `procedures.sql`, `queries.sql`).
6. Author architectural documentation (`data-dictionary.md`, `er-diagram.mmd`, `architecture.md`, `development-setup.md`).
7. Implement automated tests covering backend routes, config validation, and schema consistency.
8. Execute all tests and linters, verify clean execution, and push changes to GitHub.
