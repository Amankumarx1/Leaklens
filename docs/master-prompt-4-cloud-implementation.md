# Master Prompt 4 — Cloud Implementation & Azure Security Audit

## 1. Executive Summary

This document provides a comprehensive audit of the LeakLens application foundation following Master Prompts 1, 2, and 3, and establishes the technical blueprint for **Master Prompt 4: Azure Integration, Cloud Security & Production Deployment**.

LeakLens is an authorized data exposure detection and incident response platform. This phase transitions the application from a local development architecture to a hardened, cloud-native deployment targeting **Microsoft Azure**, adhering to DevSecOps principles, least privilege access, zero-trust network boundaries, and academic/cost-optimized constraints.

---

## 2. Existing Architecture Audit

### 2.1 Component State Prior to Phase 4

| Layer | Technology | Current State | Cloud Readiness |
| :--- | :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Tailwind-free Vanilla CSS | Standalone dev server (`localhost:5173`), production build compiles cleanly via `vite build` to `client/dist`. | Requires Express static asset serving and SPA fallback in production to eliminate CORS and simplify App Service hosting. |
| **Backend API** | Node.js 20+, Express 4.21, ES Modules | Stateless REST API, cookie-based JWT sessions, role-based access control (`ADMIN`, `ANALYST`, `COMPLIANCE_REVIEWER`). | Needs `trust proxy` configuration, hardened HTTP security headers (CSP, HSTS), and dynamic port binding (`process.env.PORT`). |
| **Relational DB** | Azure SQL / SQL Server, `mssql` driver | 9-table 3NF schema (`leaklens`), view `vw_exposure_analytics`, atomic incident resolution stored procedure `sp_resolve_incident`. Dual-mode in-memory repository fallback. | Requires managed identity authentication support, TLS enforcement (`trustServerCertificate: false` in production), and readiness validation. |
| **File Storage** | Multer memory storage | Files processed purely in memory buffers; no persistent object storage. | **Missing Cloud Integration:** Requires private Azure Blob Storage integration with randomized safe paths, no raw content in SQL, and partial-failure cleanup. |
| **Secrets Management** | `.env` file via `dotenv` | Validated at startup via `server/src/config/env.js`. Fails fast on missing production variables. | **Missing Cloud Integration:** Requires Azure Key Vault integration with Managed Identity (`DefaultAzureCredential`) and fallback for local dev. |
| **Health & Monitoring** | `GET /api/health` | Returns basic liveness, uptime, and database ping. | Missing separate `/api/health/ready` endpoint validating cloud dependencies (SQL, Blob Storage) without disclosing sensitive metadata. |
| **CI/CD & IaC** | Local scripts | Tests run via `npm test` (Vitest), client linter via `oxlint`. | Missing Bicep templates (`infra/azure/`) and GitHub Actions workflows (`.github/workflows/`). |

---

## 3. Azure Target Architecture & Resource Specifications

```
                       +------------------------------------------------+
                       |              Client Browser                    |
                       +------------------------------------------------+
                                              |
                                     HTTPS (TLS 1.2/1.3)
                                              v
                       +------------------------------------------------+
                       |          Azure App Service (Linux)             |
                       |             Plan: F1 / B1                      |
                       |                                                |
                       |   +----------------------------------------+   |
                       |   | Express Server (Single Origin)         |   |
                       |   |  - Static Assets (/client/dist)        |   |
                       |   |  - REST API (/api/*)                   |   |
                       |   |  - Health & Readiness Endpoints        |   |
                       |   +----------------------------------------+   |
                       |            ^              ^           ^        |
                       +------------|--------------|-----------|--------+
                                    |              |           |
            System-Assigned Managed Identity (DefaultAzureCredential)
                                    |              |           |
                    +---------------+              |           +----------------+
                    |                              |                            |
                    v                              v                            v
    +------------------------------+  +--------------------------+  +--------------------------+
    |      Azure Key Vault         |  |    Azure Blob Storage    |  |    Azure SQL Database    |
    |      Tier: Standard          |  |    Tier: Standard LRS    |  |    Tier: Basic / Serverless|
    |  - SESSION_SECRET            |  |  - Private Container:    |  |  - Schema: leaklens      |
    |  - JWT_SECRET                |  |    'leaklens-scans'      |  |  - Encrypted TLS (Force) |
    |  - DB_PASSWORD (fallback)    |  |  - Public Access: NONE   |  |  - Egress IP Firewall    |
    +------------------------------+  +--------------------------+  +--------------------------+
```

### 3.1 Proposed Cloud Resources & Pricing Tiers

To honor academic budget constraints and free-tier eligibility:

1. **Azure App Service Plan:** Linux B1 (Basic) or F1 (Free) tier.
   - Node.js 20 LTS runtime.
   - HTTPS Only enforced with minimum TLS 1.2.
   - System-assigned managed identity enabled.
2. **Azure SQL Database:** General Purpose Serverless or Basic Tier (5 DTU, 2GB storage, ~$5/month or covered under free tier credits).
   - Firewall restricted to App Service egress IPs.
   - Microsoft Entra authentication or least-privilege SQL user.
3. **Azure Blob Storage:** Standard General Purpose v2 (LRS - Locally Redundant Storage).
   - Hot tier for active scan jobs, transitioning to Cool/Archive.
   - Container `leaklens-scans` configured with **Private Access (no anonymous access)**.
4. **Azure Key Vault:** Standard Tier.
   - Azure RBAC permission model.
   - Role Assignment: `Key Vault Secrets User` granted to App Service managed identity.

---

## 4. Security Risks & Mitigation Controls

| Security Threat | Impact | Implemented Mitigation Control |
| :--- | :--- | :--- |
| **Hardcoded Cloud Credentials** | Credential leakage in Git | Use Managed Identity (`DefaultAzureCredential`) for Blob Storage, Key Vault, and Azure SQL. Zero secrets committed. |
| **Public Blob Storage Exposure** | Unauthorized file exfiltration | Enforce `publicNetworkAccess: 'Enabled'` with `allowBlobPublicAccess: false` on the Storage Account and private access on container `leaklens-scans`. |
| **Reversible File Path Enumeration** | Predictable storage paths | Generate cryptographically random paths: `scans/{scan_id}/{file_id}.bin`. Original filename preserved only in SQL metadata. |
| **SQL Man-in-the-Middle (MitM)** | Intercepted database traffic | Enforce `encrypt: true` and `trustServerCertificate: false` in production configuration. |
| **Orphaned Sensitive Files** | Storage and SQL inconsistency | Implement dual-phase failure compensation: if database persistence or scanning fails, execute compensating deletion (`deleteBlob`). |
| **Information Leakage via Health APIs** | Reconnaissance by attackers | Redact connection strings, hostnames, and stack traces in `/api/health` and `/api/health/ready`. |
| **Cross-Origin Attacks (CORS)** | Session hijacking / CSRF | Compile React frontend into `client/dist` and serve through Express on the same origin in production, eliminating open CORS. |

---

## 5. Local Environment Status & Deployment Prerequisites

### 5.1 Environment Check Results
- **Azure CLI (`az`):** Not installed on the local execution host (`CommandNotFoundException: The term 'az' is not recognized`).
- **Subscription Context:** No active Azure subscription credentials available locally.
- **Decision:** As required by Section 3 and 17 of the Master Prompt specification, when cloud credentials or CLI tools are absent, all integration code, SDK providers, Bicep templates, CI/CD automation, and cloud test suites must be fully implemented and verified locally with dual-mode / mock fallbacks, with the blocker and exact reproducible deployment instructions explicitly documented.

---

## 6. Implementation Plan & Execution Order

1. **Install Azure SDK Dependencies:** Add `@azure/storage-blob`, `@azure/identity`, and `@azure/keyvault-secrets` to `server/package.json`.
2. **Implement Key Vault Service:** `server/src/services/cloud/keyVaultService.js` with `DefaultAzureCredential` and graceful fallback.
3. **Implement Private Blob Storage Service:** `server/src/services/storage/blobStorageService.js` supporting private container, safe paths, upload, stream, deletion, and health checks.
4. **Integrate Storage into Scanner Workflow:** Update `server/src/services/scanner/scannerService.js` with blob persistence and failure cleanup.
5. **Implement Readiness Check:** Add `GET /api/health/ready` to `server/src/routes/health.routes.js`.
6. **Harden App Service Configuration:** Update `server/src/app.js` with production static serving, proxy trust, and security headers.
7. **Infrastructure as Code (IaC):** Create `infra/azure/main.bicep`, `infra/azure/parameters.json`, and deployment scripts (`deploy.ps1`, `deploy.sh`).
8. **CI/CD Automation:** Create `.github/workflows/ci.yml` and `.github/workflows/deploy.yml`.
9. **Network & Security Documentation:** Create `docs/azure-network-security.md`, `docs/azure-deployment.md`, and `docs/cloud-security-checklist.md`.
10. **Automated Cloud Integration Tests:** Create `tests/cloud.integration.test.js` verifying cloud endpoints and fallback resilience.
