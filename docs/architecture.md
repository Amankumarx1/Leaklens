# LeakLens — System Architecture & Design Specification

**Platform Name:** LeakLens — Authorized Data Exposure Detection & Response  
**Current Phase:** Phase 2 Complete — Authentication, Ingestion, Detection Engine & Findings Dashboard  
**Author:** Senior Full-Stack & Application Security Architect  

---

## 1. System Overview & Core Purpose

LeakLens is a defensive cybersecurity platform engineered to detect sensitive data exposures (API keys, asymmetric private keys, database credentials, authentication tokens, and personally identifiable information) in authorized files and repositories. It couples high-performance pattern matching and structural parsing with immediate evidence masking, role-based governance, tamper-resistant audit logging, and security analytics.

---

## 2. Architectural Diagram

The diagram below maps the complete system boundary, highlighting components established in **Phase 1 & Phase 2 (Active Implementation)** versus upcoming **Phase 3 (Planned Components)**.

```mermaid
flowchart TB
    subgraph ClientLayer["Frontend Client Layer (React 19 + Vite 8)"]
        UI_Login["Authentication & Role Selection (/login - Active)"]
        UI_Shell["Application Shell & Responsive Sidebar (Active)"]
        UI_Dash["Real-Time Security Posture Dashboard (/dashboard - Active)"]
        UI_Upload["File Upload & Scan Initiation (/scans/new - Active)"]
        UI_Scans["Scan Jobs & Evidence Inspector (/scans/:id - Active)"]
        UI_Findings["Interactive Findings Register & Modal (/findings - Active)"]
        UI_API["Centralized API Client with Cookie/Bearer Auth (Active)"]
    end

    subgraph APILayer["Backend Core Application (Node.js + Express 4)"]
        Middleware["Security Middleware: CORS, CookieParser, Redacted Logging, Error Handler"]
        AuthModule["RBAC Middleware: authenticateToken, requireRole(['ADMIN', 'ANALYST'])"]
        HealthRoute["GET /api/health (Operational Status)"]
        AuthAPI["POST /api/auth/login, /logout, GET /me"]
        ScanAPI["POST /api/scans (5MB Upload), GET /api/scans, GET /api/scans/:id"]
        FindingAPI["GET /api/findings (Filters & Pagination), GET /api/findings/:id"]
        AnalyticsAPI["GET /api/analytics/dashboard"]
        AuditAPI["GET /api/audit-logs"]
    end

    subgraph ServiceLayer["Service Engines (Modular Monolith)"]
        ParserEngine["Format Parsers: textParser, jsonParser, csvParser (Active)"]
        DetectionEngine["Detection Engine: Regex Evaluation & Deduplication (Active)"]
        MaskingService["Dedicated Redaction: maskSecret, maskEmail, maskApiKey, maskPrivateKey (Active)"]
        ScannerService["Scan Orchestrator: Parse -> Detect -> Redact -> Persist (Active)"]
        AuditService["Tamper-Resistant Audit Service: Immutable Event Trails (Active)"]
    end

    subgraph PersistenceLayer["Storage & Data Persistence"]
        AzureSQL[("Microsoft SQL Server / Azure SQL Database\n9 Normalized Tables (3NF)\nActive DDL & Migrations 001/002\n(Active Implementation)")]
        MemoryStore[("In-Memory Standalone Store\nFallback for Offline Dev & Isolated Tests\n(Active Fallback)")]
        AzureBlob[("Azure Blob Storage\nPrivate Encrypted File Store\n(Phase 3 Planned)")]
    end

    subgraph AnalyticsLayer["External Reporting & Compliance"]
        PowerBI["Power BI DirectQuery Dashboard (Phase 3 Planned)"]
    end

    %% Client Interactions
    UI_Login --> UI_API
    UI_Shell --> UI_API
    UI_Dash --> UI_API
    UI_Upload --> UI_API
    UI_Scans --> UI_API
    UI_Findings --> UI_API
    UI_API -->|HTTP REST / Cookies| Middleware

    %% Middleware Routing
    Middleware --> AuthModule
    AuthModule --> HealthRoute
    AuthModule --> AuthAPI
    AuthModule --> ScanAPI
    AuthModule --> FindingAPI
    AuthModule --> AnalyticsAPI
    AuthModule --> AuditAPI

    %% Backend to Services
    ScanAPI --> ScannerService
    ScannerService --> ParserEngine
    ScannerService --> DetectionEngine
    ScannerService --> MaskingService
    ScannerService --> AuditService
    AuthAPI --> AuditService

    %% Persistence
    ScannerService -->|Parameterized DML| AzureSQL
    FindingAPI -->|Parameterized SQL| AzureSQL
    AnalyticsAPI -->|SQL Aggregates| AzureSQL
    AuditService -->|Append-only audit_logs| AzureSQL
    AzureSQL -.->|Offline Dev Fallback| MemoryStore

    %% External
    PowerBI -.->|Reads vw_exposure_analytics| AzureSQL

    classDef implemented fill:#0f172a,stroke:#06b6d4,stroke-width:2px,color:#f8fafc;
    classDef planned fill:#1e293b,stroke:#64748b,stroke-width:1px,stroke-dasharray: 5 5,color:#94a3b8;

    class UI_Login,UI_Shell,UI_Dash,UI_Upload,UI_Scans,UI_Findings,UI_API,Middleware,AuthModule,HealthRoute,AuthAPI,ScanAPI,FindingAPI,AnalyticsAPI,AuditAPI,ParserEngine,DetectionEngine,MaskingService,ScannerService,AuditService,AzureSQL,MemoryStore implemented;
    class AzureBlob,PowerBI planned;
```

---

## 3. Implemented End-to-End Workflow

1. **Authentication:** The user logs in at `/login` with provisioned credentials. Password verification executes via `bcrypt.compare`. An 8-hour HttpOnly session cookie (`leaklens_token`) and JWT token are issued.
2. **Role Verification:** When navigating or initiating an upload, `requireRole` verifies authorization:
   - `ADMIN` & `ANALYST`: Authorized to trigger file scans.
   - `COMPLIANCE_REVIEWER`: Authorized for read-only viewing; scan initiation is blocked with HTTP 403 Forbidden.
3. **File Validation:** The upload handler validates extensions (`.txt`, `.json`, `.csv`), enforces 5MB limits, checks for null-byte binary headers, and maps content to locational coordinates.
4. **Detection & Redaction:** Active rules (`EMAIL_ADDRESS`, `API_KEY_CANDIDATE`, `PRIVATE_KEY_MARKER`, `SENSITIVE_IDENTIFIER`) are evaluated. Matched values are immediately masked in memory by `maskingService`.
5. **Relational Persistence:**
   - A `scan_jobs` record is created.
   - A `files` record is created with SHA-256 hash.
   - A batch of masked `findings` is inserted with foreign keys.
   - The scan job is updated to `completed`.
   - Immutable records are appended to `audit_logs`.
6. **Findings Dashboard:** The client renders real aggregate metrics, filterable finding registers, and detailed evidence views.
