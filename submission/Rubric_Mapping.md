# LeakLens — Academic Evaluation Rubric Mapping

This document provides examiners and evaluators with a cross-referenced mapping of project deliverables, architectural implementations, and source code artifacts against standard academic and technical evaluation criteria across the four disciplines:
1. **System Design**
2. **Relational Database Management Systems (RDBMS)**
3. **DP-900 / Azure Data Services**
4. **Cloud Security & DevSecOps**

---

## 1. System Design Criteria Mapping

| Rubric Criterion | Benchmark Standard | LeakLens Implementation & Evidence | Source File / Artifact |
| :--- | :--- | :--- | :--- |
| **Architecture Formulation** | Clear, justified choice between monolithic and distributed topologies. | Implemented as a **Modular Monolith** to guarantee atomic ACID transactions across incidents, remediations, and audit logs without distributed saga complexity. | [Architecture Document](file:///C:/Users/amank/.gemini/antigravity-ide/scratch/Leaklens/docs/architecture.md)<br>[Report Section 4](file:///C:/Users/amank/.gemini/antigravity-ide/scratch/Leaklens/submission/LeakLens_Project_Report.md#4-system-architecture--design) |
| **API Design & Modularity** | RESTful resource conventions, uniform error handling, and parameter validation. | REST API with standardized HTTP status codes (200, 201, 400, 401, 403, 404, 409, 500) and structured JSON error responses. | `server/src/routes/*.js`<br>`server/src/controllers/*.js` |
| **Resilience & Fault Tolerance** | Graceful degradation under dependency unavailability. | Dual-mode repository architecture (`tedious` SQL Server with automated fallback to `memoryStore.js`). Health & readiness probes (`/health/ready`). | `server/src/config/azure.js`<br>`server/src/repositories/findingRepository.js` |
| **Concurrency Control** | Protection against race conditions and lost updates. | Optimistic Concurrency Control (OCC) using integer `version` checking in stored procedures. | `database/procedures.sql`<br>`tests/incident.service.test.js` |
|
---

## 2. Relational Database Management Systems (RDBMS) Mapping

| Rubric Criterion | Benchmark Standard | LeakLens Implementation & Evidence | Source File / Artifact |
| :--- | :--- | :--- | :--- |
| **Normalization & Schema Design** | Demonstrable 3NF normalization eliminating insertion/deletion anomalies. | 9 normalized relational tables (`users`, `scans`, `detection_rules`, `findings`, `incidents`, `incident_findings`, `remediation_actions`, `audit_logs`, `refresh_tokens`). | `database/schema.sql`<br>[ER Diagram](file:///C:/Users/amank/.gemini/antigravity-ide/scratch/Leaklens/docs/er-diagram.mmd) |
| **Transactional Integrity (ACID)** | Multi-table atomic mutations with explicit commit and rollback logic. | `sp_resolve_incident` stored procedure wrapping incident update, remediation insert, and audit log write inside a single ACID transaction with `TRY...CATCH` rollback. | `database/procedures.sql`<br>`tests/incident.service.test.js` |
| **Integrity Constraints & Indexing** | Primary keys, foreign keys with referential actions, check constraints, and indexes. | Foreign key constraints on all child tables, check constraints on status fields (`open`, `investigating`, `remediated`, `resolved`), and composite indexes on search filters. | `database/schema.sql` |
| **Double-Counting Prevention in Analytics** | Elimination of Cartesian product row inflation in many-to-many joins. | Views (`vw_exposure_analytics`, `vw_incident_analytics`) utilize pre-aggregated Common Table Expressions (CTEs) before joining with `scans` or `incidents`. | `database/views.sql`<br>`tests/analytics.rdbms.test.js` |

---

## 3. DP-900 / Azure Data Services Mapping

| Rubric Criterion | Benchmark Standard | LeakLens Implementation & Evidence | Source File / Artifact |
| :--- | :--- | :--- | :--- |
| **Data Classification** | Accurate categorization into Structured, Semi-Structured, and Unstructured tiers. | Diagnostic files categorized as Unstructured (Blob Storage); JSON configs/audit metadata as Semi-Structured (NVARCHAR/JSON); entity records as Structured (Azure SQL). | [Data Classification Doc](file:///C:/Users/amank/.gemini/antigravity-ide/scratch/Leaklens/docs/data-classification.md)<br>`submission/viva/dp900-viva.md` |
| **Azure Storage Architecture** | Private blob containers, TLS in-transit, and AES-256 server-side encryption. | Azure Blob Storage integration with SAS tokens and Private Endpoint network routing. | `server/src/config/azure.js`<br>`infrastructure/modules/storage.bicep` |
| **Power BI & Business Intelligence** | Real-time forensic reporting without sensitive data caching. | Power BI DirectQuery integration connecting to `vw_incident_analytics`. Dynamic DAX measures for Mean Time to Remediate (MTTR). | [Power BI Guide](file:///C:/Users/amank/.gemini/antigravity-ide/scratch/Leaklens/docs/power-bi-analytics.md)<br>`client/src/pages/AnalyticsPage.jsx` |

---

## 4. Cloud Security & DevSecOps Mapping

| Rubric Criterion | Benchmark Standard | LeakLens Implementation & Evidence | Source File / Artifact |
| :--- | :--- | :--- | :--- |
| **Authentication & Cryptography** | Salted password hashing and secure token management. | Bcrypt hashing with cost work factor 10; signed JWTs with expiration; zero plaintext passwords in database or logs. | `server/src/repositories/userRepository.js`<br>`server/src/middleware/authMiddleware.js` |
| **Role-Based Access Control (RBAC)** | Principle of least privilege enforced across all protected resources. | Server-side role validation (`admin`, `analyst`, `auditor`). Auditor mutations rejected with HTTP 403 Forbidden. Client-side claims are never trusted. | `server/src/middleware/rbacMiddleware.js`<br>`tests/auth.rbac.test.js` |
| **Sensitive Data Masking** | Redaction of exposed secrets prior to persistence. | In-memory redaction (`ghp_***_890`, `AKIA***SAMPLE`). Secrets are redacted in RAM before SQL write, preventing plaintext exposure in databases or logs. | `server/src/services/maskingService.js`<br>`tests/masking.service.test.js` |
| **Threat Modeling & Governance** | Systematic analysis of vulnerabilities and defensive controls. | Comprehensive STRIDE threat model evaluating Spoofing, Tampering, Repudiation, Information Disclosure, DoS, and Elevation of Privilege. | [Threat Model Document](file:///C:/Users/amank/.gemini/antigravity-ide/scratch/Leaklens/docs/threat-model.md) |

---

## 5. Verification & Submission Deliverables Mapping

| Rubric Criterion | Benchmark Standard | Verification Status | Verification Command |
| :--- | :--- | :--- | :--- |
| **Automated Testing** | Multi-suite test coverage covering unit and integration scenarios. | **PASSED:** 14 test suites, 90/90 tests passing (100% pass rate). | `npm test` |
| **Static Code Analysis** | Zero linting errors and consistent code quality. | **PASSED:** Oxlint verified across 25 client files with 0 errors and 0 warnings. | `npx oxlint client/src` |
| **Production Build** | Clean production compilation of Single Page Application. | **PASSED:** Vite production build generates bundle in `client/dist`. | `npm run build:client` |
| **Viva Readiness** | Comprehensive questions, runbooks, and oral demonstration script. | **COMPLETE:** 30+ question bank, 10-minute demonstration script, and subject viva guides created in `submission/viva/`. | Inspection of `submission/viva/` |

---
*End of Rubric Mapping.*
