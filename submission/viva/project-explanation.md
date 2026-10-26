# LeakLens — Comprehensive Project Explanation & Architecture Defense

## 1. Executive Summary & Problem Statement

**LeakLens — Authorized Data Exposure Detection & Response** is an enterprise-grade defensive cybersecurity platform designed to solve the critical problem of **accidental sensitive data exposure** in authorized organizational assets, codebases, and file repositories.

### The Real-World Problem
Modern software teams routinely share configuration files, infrastructure-as-code manifests, JSON database dumps, and CSV export tables across distributed development environments. During these operations:
- Hardcoded cloud credentials (e.g., AWS Access Keys, Azure connection strings, GitHub Personal Access Tokens) are accidentally committed.
- Sensitive identifiers and internal secrets leak into non-production repositories.
- Most security scanners operate solely in retrospective reporting mode, dumping unmasked findings into vulnerable log stores and lacking auditable remediation workflows.

### The LeakLens Solution
LeakLens establishes an integrated, defense-in-depth pipeline:
1. **Multi-Format Parsing:** Ingests plain text (`.txt`), hierarchical JSON documents (`.json`), and delimited tabular files (`.csv`).
2. **In-Memory Masking:** Detects sensitive pattern signatures and immediately redacts the evidence body (`ghp_***_890`, `AKIA***SAMPLE`) in volatile memory. **Raw detected secrets are never persisted in the database.**
3. **Private Object Storage (DP-900):** Submitted files are stored in a private Azure Blob Storage container (`leaklens-scans`) with anonymous access completely disabled, using non-reversible random paths (`scans/{scan_id}/{file_id}.bin`).
4. **Relational Data Management (RDBMS):** A 9-table 3NF SQL schema captures users, scan jobs, file fingerprints (SHA-256), masked findings, incidents, and audit trails.
5. **Incident Response & Atomic Resolution:** Enforces a strict 5-state Finite-State Machine (`OPEN` $\to$ `IN_PROGRESS` $\to$ `PENDING_VERIFICATION` $\to$ `RESOLVED` $\to$ `CLOSED`) with optimistic concurrency (`version`) and multi-table transactional atomicity via stored procedure `leaklens.sp_resolve_incident`.
6. **Executive Intelligence & Power BI:** Exposes pre-aggregated analytics views (`vw_exposure_analytics`, `vw_incident_analytics`) that eliminate join row multiplication and provide DirectQuery telemetry for Mean Time to Remediate (MTTR), severity distributions, and SOC workloads.

---

## 2. Four Academic Disciplines Integration

LeakLens is explicitly architected to satisfy four academic computer science and data disciplines:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LEAKLENS DEFENSIVE PLATFORM                     │
├─────────────────────┬───────────────────┬──────────────┬───────────────┤
│ 1. SYSTEM DESIGN    │ 2. RDBMS          │ 3. DP-900    │ 4. SECURITY   │
├─────────────────────┼───────────────────┼──────────────┼───────────────┤
│ • Modular Monolith  │ • 9 Tables in 3NF │ • Structured │ • Bcrypt Hash │
│ • RESTful API       │ • Atomic Procedure│   (Azure SQL)│ • JWT Cookies │
│ • Optimistic Lock   │   (sp_resolve)    │ • Non-Rel    │ • Strict RBAC │
│ • Reverse Proxy     │ • Composite Index │   (Blob Store│ • Zero Secret │
│   Trust & HSTS      │ • Referential FKs │ • Power BI   │   Storage     │
│ • State Machine FSM │ • Duplicate-Free  │   DirectQuery│ • Managed Id  │
│                     │   Analytics Views │ • Data Class │ • CSP Headers │
└─────────────────────┴───────────────────┴──────────────┴───────────────┘
```

---

## 3. Key Architectural Decisions & Design Trade-offs

### The Core Architectural Trade-off: Modular Monolith vs. Distributed Microservices
- **Decision:** Architect LeakLens as a cohesive **Modular Monolith** (Node.js + Express + React SPA) with strict domain boundaries (`scanner/`, `storage/`, `incidents/`, `repositories/`, `auth/`) rather than decomposing it into separate microservice containers.
- **Rationale for Academic MVP:** 
  - Microservices introduce distributed transactions (2-Phase Commit / Sagas), network latency, service meshes, and multi-service deployment orchestration overhead that distract from core security and database objectives.
  - A Modular Monolith allows ACID transactional guarantees across incident state changes, finding remediation updates, and audit log generation using a single database transaction.
- **Cost / Trade-off:** 
  - File scanning shares CPU and event loop threads with API request processing. Heavy scan workloads could induce latency spikes for interactive web users.
- **Future Evolution Path:** 
  - Extract the scanning engine into an asynchronous Azure Queue / Service Bus worker process (Azure Functions or Container Apps) while keeping relational incident management in the core web backend.

---

## 4. Summary of Major Security Controls

1. **Defense-in-Depth File Protection:** Raw file uploads never reside permanently on App Service local disk space. Files are streamed to private Azure Blob Storage and deleted immediately (`deleteBlob`) if downstream database persistence fails.
2. **Zero Plaintext Credentials in Version Control:** Azure Key Vault securely manages runtime secrets (`SESSION_SECRET`, `JWT_SECRET`) retrieved dynamically via Microsoft Entra Managed Identity (`DefaultAzureCredential`).
3. **Immutable Forensic Auditing:** Audit trail records in `leaklens.audit_logs` are strictly append-only. No application role possesses `UPDATE` or `DELETE` grants.
4. **Strict Server-Side Authorization:** Client-side UI visibility is backed by rigid server-side role validation (`requireRole(['ADMIN', 'ANALYST'])`). Direct unauthorized API calls return HTTP 403 Forbidden.
