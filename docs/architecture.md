# LeakLens — System Architecture & Design Specification

**Platform Name:** LeakLens — Authorized Data Exposure Detection & Response  
**Current Phase:** Phase 3 Complete — Incident Response, Remediation & Verification Subsystem  
**Author:** Senior Full-Stack & Application Security Architect  

---

## 1. System Overview & Core Purpose

LeakLens is a defensive cybersecurity platform engineered to detect sensitive data exposures (API keys, asymmetric private keys, database credentials, authentication tokens, and personally identifiable information) in authorized files and repositories. It couples high-performance pattern matching and structural parsing with immediate evidence masking, role-based governance, incident response workflows, tamper-resistant audit logging, and security analytics.

---

## 2. Architectural Diagram

The diagram below maps the complete system boundary, highlighting components established through **Phase 1, Phase 2, and Phase 3 (Active Implementation)** versus **Phase 4 (Cloud Infrastructure & Advanced Analytics)**.

```mermaid
flowchart TB
    subgraph ClientLayer["Frontend Client Layer (React 19 + Vite 8)"]
        UI_Login["Authentication & Role Selection (/login - Active)"]
        UI_Shell["Application Shell & Responsive Sidebar (Active)"]
        UI_Dash["Security Posture Dashboard (/dashboard - Active)"]
        UI_Upload["File Upload & Scan Initiation (/scans/new - Active)"]
        UI_Scans["Scan Jobs & Evidence Inspector (/scans/:id - Active)"]
        UI_Findings["Interactive Findings Register (/findings - Active)"]
        UI_Incidents["Incident Triage & Queue (/incidents - Active)"]
        UI_NewInc["Incident Creation & Association (/incidents/new - Active)"]
        UI_IncDetail["Incident Workspace & Timeline (/incidents/:id - Active)"]
        UI_API["Centralized API Client with Cookie/Bearer Auth (Active)"]
    end

    subgraph APILayer["Backend Core Application (Node.js + Express 4)"]
        Middleware["Security Middleware: CORS, CookieParser, Redacted Logging, Error Handler"]
        AuthModule["RBAC Middleware: authenticateToken, requireRole(['ADMIN', 'ANALYST'])"]
        HealthRoute["GET /api/health (Operational Status)"]
        AuthAPI["POST /api/auth/login, /logout, GET /me"]
        ScanAPI["POST /api/scans (5MB Upload), GET /api/scans, GET /api/scans/:id"]
        FindingAPI["GET /api/findings, GET /api/findings/:id"]
        IncidentAPI["/api/incidents (CRUD, Assignment, Status Transitions, Actions, Resolution)"]
        AnalyticsAPI["GET /api/analytics/dashboard"]
        AuditAPI["GET /api/audit-logs"]
    end

    subgraph ServiceLayer["Service Engines (Modular Monolith)"]
        ParserEngine["Format Parsers: textParser, jsonParser, csvParser (Active)"]
        DetectionEngine["Detection Engine: Regex Evaluation & Deduplication (Active)"]
        MaskingService["Dedicated Redaction: maskSecret, maskEmail, maskApiKey (Active)"]
        ScannerService["Scan Orchestrator: Parse -> Detect -> Redact -> Persist (Active)"]
        IncidentService["Incident Workflow Engine: FSM Transitions & Concurrency (Active)"]
        AuditService["Tamper-Resistant Audit Service: Immutable Event Trails (Active)"]
    end

    subgraph PersistenceLayer["Storage & Data Persistence"]
        AzureSQL[("Microsoft SQL Server / Azure SQL Database\n9 Normalized Tables (3NF)\nStored Procedure sp_resolve_incident\nMigrations 001/002/003\n(Active Implementation)")]
        MemoryStore[("In-Memory Standalone Store\nFallback for Offline Dev & Isolated Tests\n(Active Fallback)")]
        AzureBlob[("Azure Blob Storage\nPrivate Encrypted File Store\n(Phase 4 Planned)")]
    end

    subgraph AnalyticsLayer["External Reporting & Compliance"]
        PowerBI["Power BI DirectQuery Dashboard (Phase 4 Planned)"]
    end

    %% Client Interactions
    UI_Login --> UI_API
    UI_Shell --> UI_API
    UI_Dash --> UI_API
    UI_Upload --> UI_API
    UI_Scans --> UI_API
    UI_Findings --> UI_API
    UI_Incidents --> UI_API
    UI_NewInc --> UI_API
    UI_IncDetail --> UI_API
    UI_API -->|HTTP REST / Cookies| Middleware

    %% Middleware Routing
    Middleware --> AuthModule
    AuthModule --> HealthRoute
    AuthModule --> AuthAPI
    AuthModule --> ScanAPI
    AuthModule --> FindingAPI
    AuthModule --> IncidentAPI
    AuthModule --> AnalyticsAPI
    AuthModule --> AuditAPI

    %% Backend to Services
    ScanAPI --> ScannerService
    ScannerService --> ParserEngine
    ScannerService --> DetectionEngine
    ScannerService --> MaskingService
    ScannerService --> AuditService
    IncidentAPI --> IncidentService
    IncidentService --> AuditService
    AuthAPI --> AuditService

    %% Persistence
    ScannerService -->|Parameterized DML| AzureSQL
    IncidentService -->|Transaction & sp_resolve_incident| AzureSQL
    FindingAPI -->|Parameterized SQL| AzureSQL
    AnalyticsAPI -->|SQL Aggregates| AzureSQL
    AuditService -->|Append-only audit_logs| AzureSQL
    AzureSQL -.->|Offline Dev Fallback| MemoryStore

    %% External
    PowerBI -.->|Reads vw_exposure_analytics| AzureSQL

    classDef implemented fill:#0f172a,stroke:#06b6d4,stroke-width:2px,color:#f8fafc;
    classDef planned fill:#1e293b,stroke:#64748b,stroke-width:1px,stroke-dasharray: 5 5,color:#94a3b8;

    class UI_Login,UI_Shell,UI_Dash,UI_Upload,UI_Scans,UI_Findings,UI_Incidents,UI_NewInc,UI_IncDetail,UI_API,Middleware,AuthModule,HealthRoute,AuthAPI,ScanAPI,FindingAPI,IncidentAPI,AnalyticsAPI,AuditAPI,ParserEngine,DetectionEngine,MaskingService,ScannerService,IncidentService,AuditService,AzureSQL,MemoryStore implemented;
    class AzureBlob,PowerBI planned;
```

---

## 3. End-to-End Workflow: Finding to Atomic Resolution

```
1. FINDING DETECTED:
   File uploaded (.json, .txt, .csv) -> Scanner identifies sensitive secret (e.g. API key).
   Secret is redacted in memory (e.g. ghp_***_890) -> Finding saved to database as 'detected'.

2. INCIDENT ESCALATION:
   Analyst selects finding(s) in Findings Register -> clicks 'Escalate to Incident'.
   POST /api/incidents executed in atomic transaction:
     - Incident created with status = 'OPEN', version = 1.
     - Junction table leaklens.incident_findings linked.
     - Finding status updated to 'confirmed'.
     - Remediation action (STATUS_CHANGE) and audit log (INCIDENT_CREATED) recorded.

3. TRIAGE & ASSIGNMENT:
   Incident assigned to Lead Security Analyst.
   PATCH /api/incidents/:id/assignment executed:
     - Assigned_to updated, version incremented.
     - Remediation action (ASSIGNMENT) and audit log (INCIDENT_ASSIGNED) recorded.

4. INVESTIGATION & REMEDIATION:
   Status transitioned: OPEN -> IN_PROGRESS.
   Analyst records investigation notes and remediation actions (e.g. key rotation in cloud provider).
   POST /api/incidents/:id/actions executed with action_type = 'REMEDIATION'.

5. INDEPENDENT VERIFICATION:
   Analyst transitions incident to PENDING_VERIFICATION.
   Verification check conducted (e.g. validation that old key returns 403 Forbidden).
   POST /api/incidents/:id/verify recorded with outcome = 'PASSED'.

6. TRANSACTIONAL RESOLUTION:
   Analyst confirms resolution with resolution summary.
   Backend executes stored procedure leaklens.sp_resolve_incident within atomic transaction:
     - Status updated to RESOLVED, resolved_at set to UTC now, resolution_summary persisted.
     - All associated findings in leaklens.findings updated to 'remediated'.
     - Remediation action inserted with action_type = 'RESOLUTION'.
     - Security audit log inserted with event_type = 'INCIDENT_RESOLVED'.
     - Transaction committed atomically.
```
