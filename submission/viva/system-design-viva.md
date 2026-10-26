# System Design & Architecture — Viva Defense Guide

## 1. System Requirements Analysis

### 1.1 Functional Requirements
- **FR-1 (Ingestion & Parsing):** Ingest authorized `.txt`, `.json`, and `.csv` files up to 10MB; compute SHA-256 cryptographic content hashes for deduplication.
- **FR-2 (Pattern Detection & Redaction):** Evaluate active regex signatures in-memory; redact sensitive bodies (`ghp_***_890`, `AKIA***SAMPLE`) before database writes.
- **FR-3 (Incident Management Lifecycle):** Escalate findings to incidents; enforce 5-state lifecycle (`OPEN` $\to$ `IN_PROGRESS` $\to$ `PENDING_VERIFICATION` $\to$ `RESOLVED` $\to$ `CLOSED`).
- **FR-4 (Remediation & Concurrency):** Track remediation actions, require independent verification checks, and enforce optimistic concurrency control (`version`).
- **FR-5 (Transactional Resolution):** Atomically update incident status, finding remediation states, remediation action history, and audit log entries via stored procedure.
- **FR-6 (Security Intelligence & Analytics):** Calculate Mean Time to Remediate (MTTR), severity distributions, and SOC analyst caseloads via duplicate-free reporting views.

### 1.2 Non-Functional Requirements
- **NFR-1 (Confidentiality & Zero Exposure):** Raw detected secrets must never be written to relational databases, application logs, or browser responses.
- **NFR-2 (Data Integrity & ACID Guarantees):** Partial mutations are disallowed; all multi-table mutations must roll back on failure.
- **NFR-3 (Availability & Resilience):** System must report operational health (`/api/health`) and external dependency readiness (`/api/health/ready`) independently.
- **NFR-4 (Performance & Bounded Latency):** File parsing and pattern matching for files <5MB must complete in <500ms. All list queries must enforce pagination limits.
- **NFR-5 (Maintainability & Clean Architecture):** Decouple controllers, service logic, data access objects (DAOs), and cloud storage providers.

---

## 2. High-Level Architecture & Component Responsibilities

```
[ Web Browser Client ]
          │
          │ HTTPS (TLS 1.2+) / Port 443
          ▼
┌────────────────────────────────────────────────────────┐
│ Express Web Application (App Service Container)        │
│                                                        │
│  ├── [ Security Headers Middleware ]                   │
│  │     CSP, HSTS, X-Frame-Options: DENY, nosniff       │
│  ├── [ Auth & RBAC Middleware ]                        │
│  │     JWT Cookie Validation, requireRole(...)         │
│  ├── [ Controllers Layer ]                             │
│  │     auth, scan, finding, incident, analytics        │
│  ├── [ Domain Services Layer ]                         │
│  │     scannerEngine, maskingService, incidentService  │
│  │     blobStorageService, keyVaultService             │
│  └── [ Repository Data Access Layer (DAOs) ]           │
│        incidentRepository, scanRepository, etc.        │
└────────────┬─────────────────────────────┬─────────────┘
             │                             │
             ▼                             ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│ Private Storage Store   │   │ Relational Database     │
│ Azure Blob Storage      │   │ Azure SQL Database      │
│ Container: leaklens-scan│   │ Schema: leaklens (3NF)  │
└─────────────────────────┘   └─────────────────────────┘
```

---

## 3. The Core Architectural Trade-off

### Modular Monolith vs. Distributed Microservices
- **Viva Defense Question:** *"Why did you build LeakLens as a Modular Monolith instead of deploying separate microservices for scanning, incidents, and auth?"*
- **Defensible Technical Answer:**
  1. **Transactional Boundaries:** The incident resolution workflow requires ACID guarantees across findings, incident records, remediation notes, and audit logs. In a microservices architecture, this would require distributed transactions (Two-Phase Commit or the Saga Pattern with compensating transactions), introducing extreme complexity, partial failure states, and eventual consistency delays.
  2. **Operational Simplicity:** A single deployable container image minimizes operational overhead, allows single-origin static asset delivery (eliminating CORS misconfigurations), and fits within academic/free-tier compute budgets (Azure App Service B1/F1).
  3. **Domain Decoupling:** Even though unified in one deployment, the codebase enforces strict domain isolation (`services/scanner`, `services/incidents`, `services/storage`).
- **Acknowledged Limitation:** File parsing shares CPU resources with HTTP request handling. A massive file upload could block the Node.js event loop.
- **Future Scaling Path:** Move the parser/scanner engine to an asynchronous background worker using Azure Service Bus queues and Azure Container Apps, while retaining the core REST API and relational incident manager in App Service.

---

## 4. Concurrency Control: Optimistic Versioning

### The Lost Update Problem:
In a busy Security Operations Center (SOC), Analyst A and Analyst B open the same critical incident simultaneously:
- Analyst A updates status to `IN_PROGRESS` and assigns it to themselves.
- Analyst B adds an investigation note and changes status to `PENDING_VERIFICATION` without seeing Analyst A's assignment.
- Without concurrency controls, Analyst B's write silently overwrites Analyst A's changes (Lost Update Anomaly).

### How LeakLens Solves This:
LeakLens implements **Optimistic Concurrency Control** via an integer `version` token on `leaklens.incidents`:
1. When the client loads an incident, it receives `version: 1`.
2. When submitting a mutation, the client sends `expectedVersion: 1`.
3. The database updates the row *only if* the current version matches:
   ```sql
   UPDATE leaklens.incidents
   SET status = @new_status, version = version + 1, updated_at = SYSUTCDATETIME()
   WHERE incident_id = @id AND version = @expected_version;
   ```
4. If `@@ROWCOUNT == 0`, a conflict occurred. The backend catches this and throws HTTP 409 Conflict with code `CONCURRENCY_CONFLICT`, instructing the second analyst to refresh the record.

---

## 5. RESTful API Design Standards

LeakLens adheres to strict RESTful conventions:
- **Resource Naming:** Nouns representing domain entities (`/api/scans`, `/api/findings`, `/api/incidents`, `/api/audit-logs`).
- **HTTP Verbs:**
  - `GET`: Safe, idempotent data retrieval.
  - `POST`: Creation of scan jobs, incidents, remediation actions, and verification checks.
  - `PATCH`: Partial entity updates (e.g., `/api/incidents/:id/assignment`).
  - `DELETE`: Disassociation of findings from incidents.
- **Status Codes:**
  - `200 OK`: Successful retrieval or synchronous mutation.
  - `201 Created`: Successful creation of scan or incident.
  - `400 Bad Request`: Validation failure (malformed payload, unsupported file format).
  - `401 Unauthorized`: Missing or invalid session token.
  - `403 Forbidden`: Authenticated user lacks required role permissions.
  - `404 Not Found`: Target entity does not exist.
  - `409 Conflict`: Concurrency version mismatch or illegal FSM state transition.
  - `503 Service Unavailable`: Readiness check failure (Azure SQL or Blob Storage unreachable).
- **Uniform Response Envelope:**
  ```json
  {
    "success": true,
    "data": { ... },
    "error": null,
    "pagination": { "limit": 50, "offset": 0, "total": 120 }
  }
  ```
