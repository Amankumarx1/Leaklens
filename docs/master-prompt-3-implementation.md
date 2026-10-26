# LeakLens Phase 3 Implementation Audit & Architecture Plan
**Master Prompt 3: Incident Response, Remediation & Audit Management**

---

## 1. Initial Implementation Audit

### 1.1 Existing Architecture & Deliverables (from Master Prompts 1 & 2)
An exhaustive inspection of the repository revealed the current operational baseline:
- **Backend & Authentication:**
  - Express 4 application in `server/src/app.js` with ES modules, `cookieParser`, centralized `errorHandler`, and `requestLogger`.
  - Authentication middleware (`server/src/middleware/auth.js`) supporting JWT tokens extracted from HttpOnly cookies and `Bearer` headers.
  - Role-based authorization (`requireRole`) supporting roles: `ADMIN`, `ANALYST`, and `COMPLIANCE_REVIEWER`.
  - Pre-seeded users: `admin@leaklens.local`, `analyst@leaklens.local`, `compliance@leaklens.local` (`scripts/seed.js`).
- **Scanner & Findings Subsystem:**
  - Independent parsing modules (`textParser.js`, `jsonParser.js`, `csvParser.js`, `parserFactory.js`) enforcing a 5 MB upload limit and rejecting binary content.
  - Safe in-memory masking (`maskingService.js`) ensuring zero raw secrets enter SQL finding records, ordinary API responses, or logs.
  - 4 canonical rules: `EMAIL_ADDRESS_RULE`, `API_KEY_CANDIDATE_RULE`, `PRIVATE_KEY_MARKER_RULE`, and `SENSITIVE_IDENTIFIER_RULE`.
- **Database Architecture:**
  - 9 normalized 3NF tables in `database/schema.sql`: `users`, `scan_jobs`, `files`, `detection_rules`, `findings`, `incidents`, `incident_findings`, `remediation_actions`, and `audit_logs`.
  - Stored procedure placeholder `sp_resolve_incident` in `database/procedures.sql`.
  - Reporting view `vw_exposure_analytics` in `database/views.sql`.
  - Repository layer with automated in-memory store fallback (`memoryStore.js`) for local development and test suites.
- **Frontend State:**
  - React 19 + Vite 8 SPA in `client/` with dark navy cybersecurity aesthetic.
  - Implemented pages: `LoginPage.jsx`, `DashboardPage.jsx`, `ScansPage.jsx`, `NewScanPage.jsx`, `ScanDetailPage.jsx`, `FindingsPage.jsx`, `AuditLogsPage.jsx`, `SettingsPage.jsx`.
  - `IncidentsPage.jsx` currently exists as a placeholder layout without interactive incident management, assignment, or remediation capabilities.
- **Verification Baseline:**
  - 11 Vitest test suites (55 tests) passing cleanly with 0 failures.
  - Oxlint reports 0 warnings and 0 errors across 23 client files.

---

## 2. Gap Analysis & Incompatible Assumptions

| Dimension | Current State | Required Phase 3 State | Action Needed |
|---|---|---|---|
| **Incident Statuses** | `open`, `under_investigation`, `contained`, `resolved`, `closed` in `CK_incidents_status` | `OPEN`, `IN_PROGRESS`, `PENDING_VERIFICATION`, `RESOLVED`, `CLOSED` | Update check constraint via migration `003` to support both casing conventions. |
| **Incident Priority** | `critical`, `high`, `medium`, `low` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` | Support uppercase enums in check constraints and UI. |
| **Incident Columns** | Missing `closed_at`, `resolution_summary`, and concurrency token `version` | Detailed resolution metadata and optimistic concurrency | Add `closed_at`, `resolution_summary`, and `version` columns to `leaklens.incidents`. |
| **Remediation Action Types** | Specific actions (`secret_revocation`, `key_rotation`, etc.) | Workflow actions: `INVESTIGATION`, `ASSIGNMENT`, `STATUS_CHANGE`, `REMEDIATION`, `VERIFICATION`, `COMMENT`, `RESOLUTION`, `REOPENED` | Expand `CK_remediation_actions_action_type` check constraint. |
| **Incident Navigation** | `incidents` is not linked in sidebar; placeholder page only | Interactive incident list, creation workflow, detail view, timeline, status transitions | Implement `IncidentsPage.jsx`, `NewIncidentPage.jsx`, `IncidentDetailPage.jsx`, and add to `Sidebar.jsx`. |
| **Findings Escalation** | Findings page is read-only inspection | Ability to select finding(s) and escalate into a new incident | Add "Escalate to Incident" action from findings table and detail modal. |
| **Resolution Procedure** | `sp_resolve_incident` lacks optimistic locking and verification outcome parameter | Atomic resolution with state check, concurrency token, finding status update, remediation record, and audit log | Re-write `sp_resolve_incident` with explicit transaction boundaries, error codes, and rollback. |
| **API Endpoints** | No incident endpoints mounted in Express router | Full REST endpoints for `/api/incidents/*` | Implement `incidentController.js`, `incidentService.js`, `incidentRepository.js`, and mount in `routes/index.js`. |

---

## 3. Implementation Plan & Execution Order

1. **Incident Lifecycle Specification:**
   - Author `docs/incident-lifecycle.md` documenting states, allowed transitions, validation requirements, and role permissions.
   - Author `docs/incident-response-design.md` detailing database relationships, transaction boundaries, optimistic concurrency, and audit guarantees.
2. **Database Migrations & Schema Refinement:**
   - Create `database/migrations/003_phase3_incident_remediation.sql`.
   - Update `database/schema.sql`, `database/procedures.sql`, and `database/queries.sql`.
3. **Repository & Service Layer:**
   - Update `memoryStore.js` with `incidents: []`, `incident_findings: []`, and `remediation_actions: []`.
   - Implement `incidentRepository.js` supporting dual-mode (MSSQL and memoryStore).
   - Implement `userRepository.getEligibleAssignees()`.
   - Implement `incidentService.js` enforcing lifecycle transitions, role rules, input sanitation, and audit generation.
4. **Backend Controllers & Routes:**
   - Implement `incidentController.js` covering creation, listing, detail, assignment, status change, action logging, resolution, and reopening.
   - Implement `server/src/routes/incident.routes.js` and mount at `/api/incidents`.
5. **Frontend Incident Response UI:**
   - Build `IncidentsPage.jsx` with real status filters, priority badges, and server-side metrics.
   - Build `NewIncidentPage.jsx` with finding selection and duplicate association guards.
   - Build `IncidentDetailPage.jsx` with overview, assignment selector, activity timeline, remediation note form, verification form, and status transition controls.
   - Connect findings page escalation to new incident creation.
   - Update `Sidebar.jsx`, `App.jsx`, and `api.js`.
6. **Automated Testing & Verification:**
   - Add comprehensive tests in `tests/incident.workflow.test.js` covering creation, association, assignment, transitions, remediation, verification, concurrency, and RBAC.
   - Run full Vitest suite, Oxlint linter, and Vite client build.
   - Document verified results.
