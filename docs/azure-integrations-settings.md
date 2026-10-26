# LeakLens — Azure Integrations Architecture, Configuration & Connection Wizard

## 1. Executive Summary

LeakLens is an enterprise data-exposure detection and incident response platform designed for hybrid and native Microsoft Azure cloud deployments. This document outlines the architecture, configuration sources, security controls, connection validation mechanisms, and administrative interfaces for all core Azure integrations:

1. **Azure SQL Database** (Relational storage, stored procedures, optimistic concurrency, and tamper-resistant audit logs).
2. **Azure Blob Storage** (Private, non-public object storage for volatile file scans and cryptographic hash verification).
3. **Azure Key Vault** (Centralized secrets management with Azure Managed Identity retrieval and in-memory caching).
4. **Power BI** (Executive compliance reporting, DirectQuery dataset federation, and secure external report linking).
5. **Azure App Service & Managed Identity** (Host environment, system-assigned managed identity, and hardened perimeter controls).

---

## 2. Integration Architecture & Current State Audit

| Service / Resource | Implemented Components | Configuration Source | Authentication Method | Current Status |
| :--- | :--- | :--- | :--- | :--- |
| **Azure SQL Database** | MSSQL connection pool (`connection.js`), parameter binding, transient retry logic, automated schema verification | Environment (`DB_SERVER`, `DB_NAME`, `AZURE_SQL_AUTH_TYPE`, `DB_USER`) | Azure Entra Managed Identity (`azure-active-directory-default`) or SQL auth fallback | Configured & Testable; local in-memory fallback when offline |
| **Azure Blob Storage** | `@azure/storage-blob`, opaque blob path generation (`scans/{scanId}/{fileId}.bin`), private container enforcement | Environment (`AZURE_STORAGE_ACCOUNT_NAME`, `AZURE_STORAGE_CONTAINER_NAME`) | DefaultAzureCredential (Managed Identity) or connection string | Configured & Testable; isolated test probe cleanup |
| **Azure Key Vault** | `@azure/keyvault-secrets`, in-memory cache, sanitized secret retrieval, fallback to environment | Environment (`AZURE_KEYVAULT_NAME`, `KEY_VAULT_URI`) | DefaultAzureCredential (System-assigned MSI) | Configured & Testable; no secret exposure |
| **Power BI** | DirectQuery views (`vw_exposure_analytics`, `vw_incident_analytics`), validated external link integration | Stored Preferences (`power_bi_report_url`, `power_bi_report_name`) | User-authenticated organizational Entra ID session (Azure Portal / App) | Link-Configured; strict SSRF & domain allowlist |
| **Azure App Service & MSI** | Security headers (CSP, HSTS, X-Frame-Options: DENY), MSI detection (`IDENTITY_ENDPOINT`), health probe (`/api/health/ready`) | App Service Environment (`WEBSITE_SITE_NAME`, `REGION_NAME`) | Managed Identity (System-Assigned) | Operational; status verified via backend runtime checks |

---

## 3. Configuration Sources of Truth & Least Privilege

LeakLens maintains a strict architectural distinction between **Trusted Runtime Configuration** and **User Application Preferences**:

### 3.1 Server-Side Runtime Configuration (Immutable at UI level)
- Database connection strings, SQL server hostnames, storage account names, and Key Vault endpoints are sourced strictly from trusted runtime environment variables (`process.env`), App Service Configuration, or Azure Key Vault references.
- **Security Rule**: The Settings UI **never** allows web users or administrators to overwrite active database connection strings or runtime secrets via form submissions. Modifying runtime endpoints requires applying updates through Azure Portal or ARM/Bicep deployments, followed by an App Service restart.
- The UI provides copyable, non-secret configuration templates to guide administrators.

### 3.2 Non-Secret Application Preferences (Persisted via Settings)
- Allowed preferences include:
  - Power BI report URL and friendly display name.
  - Azure subscription display name and resource group (documentation metadata).
  - UI telemetry polling rates and upload advisory thresholds.
- Validated server-side and persisted in memory/database store.

### 3.3 Zero Secrets Exposure
- Plaintext passwords, connection strings, SAS tokens, and client secrets are **never** returned to the browser, stored in browser local storage, or logged to audit trails.

---

## 4. Connection Testing & Validation Specifications

All connectivity tests execute strictly via protected backend endpoints restricted to users with the `ADMIN` role.

### 4.1 Azure SQL Database Test (`POST /api/admin/integrations/sql/test`)
1. Executes `SELECT 1 AS is_alive` against the configured connection pool.
2. Checks for the existence of required schema objects in `leaklens` schema (`scan_jobs`, `findings`, `incidents`, `audit_logs`, `vw_exposure_analytics`).
3. Measures connection latency in milliseconds.
4. Returns a sanitized status (`CONNECTED`, `SCHEMA_INCOMPLETE`, or `CONNECTION_FAILED`) with specific error codes, concealing all credentials.

### 4.2 Azure Blob Storage Test (`POST /api/admin/integrations/blob/test`)
1. Uses the active `BlobServiceClient` and target container (`leaklens-scans`).
2. Checks container existence and validates that public anonymous access is disabled.
3. Writes a temporary, isolated probe object to `healthcheck/connectivity-probe-<timestamp>.bin`.
4. Reads the probe to verify data integrity.
5. Deletes the probe immediately (compensating cleanup).
6. Never touches or lists user scan uploads during health checks.

### 4.3 Azure Key Vault Test (`POST /api/admin/integrations/key-vault/test`)
1. Initializes `SecretClient` using `DefaultAzureCredential`.
2. Validates accessibility of the configured vault URI (`https://<vault-name>.vault.azure.net`).
3. Verifies that the identity has `Key Vault Secrets User` or `get` permissions without returning secret values.
4. Returns sanitized latency and status.

### 4.4 Power BI Integration Test (`POST /api/admin/integrations/power-bi/test`)
1. Validates the supplied report URL against a strict domain allowlist:
   - `app.powerbi.com`
   - `powerbi.com`
   - `msit.powerbi.com`
   - `*.powerbi.com`
2. Enforces HTTPS and rejects internal/private network IP addresses (SSRF prevention).
3. Verifies URL syntax and optional GUID workspace/report identifiers.
4. Confirms whether external link mode or embedded mode is active.

---

## 5. Guided Azure Setup Wizard (8 Stages)

The Settings page includes a step-by-step Setup Wizard to guide administrators through configuring cloud resources in Azure Portal:

1. **Stage 1 — Azure Resource Information**: SMR/subscription metadata, resource group, region, and App Service details.
2. **Stage 2 — Azure SQL Configuration**: Hostname syntax validation (`*.database.windows.net`), database name, Entra Managed Identity configuration guide, firewall setup.
3. **Stage 3 — Blob Storage Configuration**: Storage account name (`[a-z0-9]{3,24}`), container name (`leaklens-scans`), Private access enforcement.
4. **Stage 4 — Key Vault Configuration**: Vault URI, system identity role assignment (`Key Vault Secrets User`), secret reference names.
5. **Stage 5 — Power BI Configuration**: Executive report URL allowlist, DirectQuery workspace setup, report name.
6. **Stage 6 — Validate Connections**: Sequential live backend connectivity test runner displaying real-time status badges for all 4 services.
7. **Stage 7 — Review Configuration**: Clear breakdown of public resource identifiers, non-secret environment variables, required Portal permissions, and application restart triggers.
8. **Stage 8 — Finish**: Summary of completed setup, confirmation checklist, and quick links.

---

## 6. Audit Logging & Security Controls

Every administrative integration action is recorded in the immutable audit trail (`leaklens.audit_logs`):
- `INTEGRATION_TEST_EXECUTED`: Service name, latency, outcome (`SUCCESS` / `FAILED`), operator attribution.
- `INTEGRATION_PREFERENCES_SAVED`: Updated non-secret configuration fields, operator attribution.
- Sanitized payloads guarantee that no credentials, tokens, or private endpoints are captured.
