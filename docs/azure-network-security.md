# Azure Cloud Network Security & Architecture Specification

## 1. Overview & Threat Model

LeakLens is an authorized sensitive-data exposure detection and incident response system. Because the platform scans sensitive files (credentials, API keys, connection strings, PII), maintaining strict network isolation and minimizing public attack surfaces is paramount.

This document describes the network architecture, communication pathways, access controls, perimeter firewalls, and academic cost optimizations implemented for the Azure cloud deployment.

---

## 2. Network Architecture Diagram

```
[ User Browser / Analyst ]
            │
            │ HTTPS (TLS 1.2 / TLS 1.3 enforced)
            ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Azure Front Door / App Service Frontend Proxy (Public Endpoint)        │
│ Port 443 only. Plain HTTP automatically redirected.                    │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ Internal App Service Routing
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Azure App Service (Linux Web App Container)                            │
│ Express REST API + Compiled React SPA Bundle (Single Origin)           │
│ System-Assigned Managed Identity (DefaultAzureCredential)              │
└────────────┬───────────────────────┬──────────────────────────┬────────┘
             │                       │                          │
             │ HTTPS (TLS 1.2)       │ HTTPS (TLS 1.2)          │ Encrypted TDS (Port 1433)
             │ Azure Storage SDK     │ Azure Key Vault SDK      │ MSSQL Driver (encrypt: true)
             ▼                       ▼                          ▼
┌─────────────────────────┐ ┌─────────────────────────┐ ┌─────────────────────────┐
│ Azure Storage Account   │ │ Azure Key Vault         │ │ Azure SQL Database      │
│ - Public Blob: DISABLED │ │ - RBAC Mode: Enabled    │ │ - Encrypt: TRUE         │
│ - Private Container:    │ │ - Bypass: AzureServices │ │ - TrustCert: FALSE      │
│   'leaklens-scans'      │ │ - Secrets User Role     │ │ - Firewall: App Service │
│ - Anon Access: BLOCKED  │ │ - Anon Access: BLOCKED  │ │   Egress IPs Only       │
└─────────────────────────┘ └─────────────────────────┘ └─────────────────────────┘
```

---

## 3. Communication Pathways & Access Restrictions

| Source | Destination | Protocol / Port | Authentication / Access Control | Encryption in Transit |
| :--- | :--- | :--- | :--- | :--- |
| **Client Browser** | App Service | HTTPS / 443 | Cookie-based JWT sessions (`HttpOnly`, `SameSite=Lax`, `Secure`) | TLS 1.2 or 1.3 mandatory |
| **App Service** | Azure Blob Storage | HTTPS / 443 | Microsoft Entra ID via App Service Managed Identity (`Storage Blob Data Contributor`) | TLS 1.2 enforced (`supportsHttpsTrafficOnly: true`) |
| **App Service** | Azure Key Vault | HTTPS / 443 | Microsoft Entra ID via App Service Managed Identity (`Key Vault Secrets User`) | TLS 1.2 enforced |
| **App Service** | Azure SQL Database | TDS / 1433 | Entra ID Managed Identity (`azure-active-directory-default`) or least-privilege SQL login | TLS 1.2 enforced (`encrypt: true`, `trustServerCertificate: false`) |
| **Direct Internet** | Azure Blob Storage | Any | **BLOCKED:** Anonymous blob read access explicitly disabled (`allowBlobPublicAccess: false`) | N/A (Denied) |
| **Direct Internet** | Azure SQL Database | TDS / 1433 | **BLOCKED:** Firewall blocks arbitrary external IP addresses | N/A (Denied) |

---

## 4. Firewall & Perimeter Controls

### 4.1 Azure App Service Network Controls
- **HTTPS Only:** Plaintext HTTP access is blocked; all HTTP traffic is redirected with HTTP 301 to HTTPS.
- **Minimum TLS Version:** Locked to TLS 1.2 across all endpoints.
- **Insecure Protocols:** FTPS and plaintext FTP are explicitly set to `Disabled`.
- **Remote Debugging:** Disposed and disabled in production.

### 4.2 Azure SQL Firewall Strategy
To balance security with student/academic budget constraints:
1. **Low-Cost Configuration:** The Azure SQL Firewall is restricted to Azure Data Center IP ranges (`AllowAllWindowsAzureIps: 0.0.0.0`), allowing App Service worker nodes to communicate with the database server without incurring expensive Virtual Network (VNet) NAT Gateway or dedicated Private Endpoint charges.
2. **Enterprise / Private Endpoint Alternative:** When an enterprise subscription or funded VNet is available, the SQL Server public network access is disabled entirely (`publicNetworkAccess: 'Disabled'`), and communication is routed exclusively through a Private Endpoint residing on an internal subnet (`10.0.1.0/24`) via Azure Private DNS Zones.

### 4.3 Azure Blob Storage Container Security
- Storage accounts are configured with `allowBlobPublicAccess = false`.
- The container `leaklens-scans` has its public access tier set to `None`.
- Files cannot be downloaded via direct public URL; all file access requires application-level authentication, RBAC authorization, and proxying through Express.

---

## 5. Defense-in-Depth Security Controls

1. **Randomized Blob Paths:** User filenames are never used as storage paths. All files are assigned non-reversible paths: `scans/{scan_id}/{file_id}.bin`.
2. **Single-Origin Deployment:** The React SPA is built into static assets served directly by Express. This eliminates CORS misconfiguration vulnerabilities and prevents cross-site script request forgery.
3. **HTTP Security Headers:**
   - `Content-Security-Policy`: Restricts scripts, styles, and frames to `'self'`.
   - `X-Frame-Options: DENY`: Prevents UI clickjacking attacks.
   - `X-Content-Type-Options: nosniff`: Prevents MIME-type confusion attacks.
   - `Referrer-Policy: strict-origin-when-cross-origin`: Minimizes referrer leakage.
   - `Strict-Transport-Security (HSTS)`: Preload enabled with a 1-year duration.
4. **Information Disclosure Prevention:** The `/api/health` and `/api/health/ready` endpoints explicitly redact internal database hostnames, credentials, and connection strings.
