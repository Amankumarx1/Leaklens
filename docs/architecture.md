# LeakLens — System Architecture & Design Specification

**Platform Name:** LeakLens — Authorized Data Exposure Detection & Response  
**Current Phase:** Phase 4 Complete — Azure Integration, Cloud Security & Production Deployment  
**Author:** Senior Cloud Architect & Application Security Engineer  

---

## 1. System Overview & Core Purpose

LeakLens is a defensive cybersecurity platform engineered to detect sensitive data exposures (API keys, asymmetric private keys, database credentials, authentication tokens, and personally identifiable information) in authorized files and repositories. It couples high-performance pattern matching and structural parsing with immediate evidence masking, role-based governance, incident response workflows, tamper-resistant audit logging, cloud object storage, and security analytics.

Phase 4 establishes native **Microsoft Azure integration**, migrating the platform into a hardened, cloud-native architecture powered by Azure App Service, Azure SQL Database, Private Azure Blob Storage, Azure Key Vault, and System-Assigned Managed Identity.

---

## 2. Architectural Diagram

The diagram below maps the complete system boundary, highlighting components established through **Phase 1, 2, 3, and Phase 4 (Active Cloud Implementation)**.

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
        UI_Static["Compiled Single-Origin Static Assets (/client/dist - Active)"]
    end

    subgraph HostingLayer["Azure App Service (Linux Web App B1/F1)"]
        ReverseProxy["Front-Door / App Service TLS Termination (HTTPS 443 Only)"]
        ExpressCore["Hardened Express Server (Single Origin, trust proxy: 1)"]
        SecurityHeaders["Security Headers: CSP, HSTS, X-Frame-Options: DENY, nosniff"]
        HealthLiveness["Liveness Probe: GET /api/health (Process & Uptime)"]
        HealthReadiness["Readiness Probe: GET /api/health/ready (SQL, Storage, KeyVault)"]
        ManagedIdentity["System-Assigned Managed Identity (DefaultAzureCredential)"]
    end

    subgraph ServiceLayer["Backend Engines (Modular Monolith)"]
        AuthService["RBAC & Session Management: JWT in HttpOnly Cookies (Active)"]
        ScannerService["Scan Orchestrator: Upload -> Parse -> Detect -> Redact -> Persist (Active)"]
        StorageService["Azure Blob Storage Service: Safe Paths & Partial-Failure Rollback (Active)"]
        KeyVaultService["Azure Key Vault Service: In-Memory Cached Secret Client (Active)"]
        IncidentService["Incident Workflow Engine: FSM Transitions & Concurrency (Active)"]
        AuditService["Tamper-Resistant Audit Service: Immutable Event Trails (Active)"]
    end

    subgraph PersistenceLayer["Azure Cloud Persistence & Data Services"]
        AzureSQL[("Azure SQL Database / SQL Server\n9 Normalized Tables (3NF)\nStored Procedure sp_resolve_incident\nTransient Error Retry Logic\n(Active Cloud Implementation)")]
        AzureBlob[("Azure Blob Storage\nPrivate Container: 'leaklens-scans'\nPublic Access: DISABLED\nSafe Paths: scans/{scanId}/{fileId}.bin\n(Active Cloud Implementation)")]
        AzureKeyVault[("Azure Key Vault\nStandard Tier, Azure RBAC Mode\nRuntime Secrets: SESSION_SECRET, JWT_SECRET\n(Active Cloud Implementation)")]
        MemoryStore[("In-Memory Standalone Store\nFallback for Offline Dev & Isolated Tests\n(Active Fallback)")]
    end

    subgraph IaCLayer["Infrastructure as Code & CI/CD"]
        Bicep["Bicep Templates: infra/azure/main.bicep (Active)"]
        GH_CI["GitHub Actions CI: Lint, Vitest, Vite Build (Active)"]
        GH_CD["GitHub Actions CD: OIDC Federated Azure Deployment (Active)"]
    end

    %% Client Interactions
    ClientLayer -->|HTTPS / 443| ReverseProxy
    ReverseProxy --> ExpressCore
    ExpressCore --> SecurityHeaders
    SecurityHeaders --> HealthLiveness
    SecurityHeaders --> HealthReadiness
    SecurityHeaders --> ServiceLayer

    %% Service to Cloud
    ScannerService --> StorageService
    StorageService -->|Managed Identity Auth| AzureBlob
    StorageService -.->|Compensating Cleanup on Failure| AzureBlob
    KeyVaultService -->|Managed Identity Auth| AzureKeyVault
    ScannerService -->|Encrypted TDS / Transient Retry| AzureSQL
    IncidentService -->|sp_resolve_incident| AzureSQL
    AuditService -->|Append-only audit_logs| AzureSQL
    AzureSQL -.->|Offline Dev Fallback| MemoryStore

    %% Identity Bindings
    ManagedIdentity -->|Storage Blob Data Contributor| AzureBlob
    ManagedIdentity -->|Key Vault Secrets User| AzureKeyVault

    classDef implemented fill:#0f172a,stroke:#06b6d4,stroke-width:2px,color:#f8fafc;
    classDef cloud fill:#0369a1,stroke:#38bdf8,stroke-width:2px,color:#ffffff;
    classDef fallback fill:#1e293b,stroke:#64748b,stroke-width:1px,stroke-dasharray: 5 5,color:#94a3b8;

    class UI_Login,UI_Shell,UI_Dash,UI_Upload,UI_Scans,UI_Findings,UI_Incidents,UI_NewInc,UI_IncDetail,UI_Static,ReverseProxy,ExpressCore,SecurityHeaders,HealthLiveness,HealthReadiness,AuthService,ScannerService,IncidentService,AuditService,Bicep,GH_CI,GH_CD implemented;
    class AzureSQL,AzureBlob,AzureKeyVault,StorageService,KeyVaultService,ManagedIdentity cloud;
    class MemoryStore fallback;
```

---

## 3. End-to-End Cloud Workflow

```
1. INCOMING REQUEST & HOSTING:
   - External browser connects to Azure App Service over HTTPS (TLS 1.2+ enforced).
   - Express serves the compiled React single-page application from 'client/dist' on the same origin.
   - Cross-origin issues are eliminated, and strict CSP, HSTS, and X-Frame-Options headers are applied.

2. AUTHENTICATED SCAN INITIATION:
   - User uploads authorized file (.txt, .json, .csv) via POST /api/scans.
   - Multer memory storage validates MIME type, size (<10MB), and non-empty content.

3. DUAL-PHASE OBJECT STORAGE & SCANNING:
   - Scan orchestrator generates a non-reversible path: 'scans/{scan_id}/{file_id}.bin'.
   - File is uploaded to the private Azure Blob Storage container ('leaklens-scans') via Managed Identity.
   - Public access to the container is completely disabled.
   - The file content is parsed, scanned by detection rules, and sensitive excerpts are masked.

4. TRANSACTIONAL PERSISTENCE & CONSISTENCY:
   - Scan metadata, file record (including blob_path), and masked findings are persisted to Azure SQL.
   - If downstream parsing or database persistence fails, a compensating cleanup call (deleteBlob)
     immediately purges the uploaded blob, preventing orphaned storage objects.
   - Audit trail records scan creation, execution, and completion events.

5. INCIDENT MANAGEMENT & ATOMIC RESOLUTION:
   - Findings escalated to incidents undergo investigation, status transitions, and independent verification.
   - Atomic resolution invokes stored procedure leaklens.sp_resolve_incident, updating findings to 'remediated',
     recording resolution actions, and appending an immutable audit record in a single transaction.

6. SECRETS & CLOUD MONITORING:
   - Key Vault provides runtime secrets (SESSION_SECRET, JWT_SECRET) with zero credentials stored in Git.
   - Liveness probe (/api/health) and readiness probe (/api/health/ready) report operational dependency health
     without disclosing internal hostnames, credentials, or secrets.
```

---

## 4. Distinction Between Implemented & Planned Components

| Component | Status | Implementation Details |
| :--- | :--- | :--- |
| **Frontend SPA (React 19)** | **Active & Implemented** | Full component tree, state management, findings register, incident workspace, and timeline. |
| **Backend REST API (Express 4)** | **Active & Implemented** | Hardened single-origin server, RBAC middleware, 9 route modules, sanitized request logger. |
| **Azure SQL Persistence** | **Active & Implemented** | 9-table schema, view `vw_exposure_analytics`, stored procedure `sp_resolve_incident`, transient error retry. |
| **Private Azure Blob Storage** | **Active & Implemented** | Service provider `blobStorageService.js`, private container `leaklens-scans`, randomized blob paths, compensating cleanup. |
| **Azure Key Vault Integration** | **Active & Implemented** | In-memory cached secret client `keyVaultService.js` with `DefaultAzureCredential` and local fallback. |
| **Health & Readiness Endpoints** | **Active & Implemented** | `/api/health` (liveness) and `/api/health/ready` (readiness for SQL, Blob, and Key Vault). |
| **Infrastructure as Code (IaC)** | **Active & Implemented** | Bicep templates `infra/azure/main.bicep` and deployment scripts `deploy.ps1`, `deploy.sh`. |
| **CI/CD Automation** | **Active & Implemented** | GitHub Actions workflows `.github/workflows/ci.yml` and `deploy.yml` with OIDC authentication. |
| **Live Azure Resource Deployment** | **Configured / Unexecuted** | Local execution workstation lacks Azure CLI (`az`) and cloud credentials; assets validated locally. |
| **Power BI DirectQuery** | **Planned (Phase 5)** | Advanced compliance dashboards reading `vw_exposure_analytics`. |
