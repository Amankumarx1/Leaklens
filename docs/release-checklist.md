# LeakLens Production Release Checklist & Operational Gates

This checklist establishes the formal release verification procedure for deploying or demonstrating **LeakLens — Authorized Data Exposure Detection & Response**.

---

## 1. Pre-Release Quality Gates

| # | Verification Gate | Command / Verification Action | Expected Outcome | Status |
| :--- | :--- | :--- | :--- | :--- |
| **G1** | **Git Working Tree Baseline** | `git status` | Clean working tree; no uncommitted debug code or untracked credentials. | **VERIFIED** |
| **G2** | **Static Code Analysis (Linter)** | `npm run lint:client` | `oxlint` finishes with **0 warnings and 0 errors** across all JavaScript and JSX source files. | **VERIFIED** |
| **G3** | **Automated Test Suite** | `npm test` | Vitest executes **14 test suites with 90 tests passing, 0 failures, 0 skipped**. | **VERIFIED** |
| **G4** | **Production Client Build** | `npm run build:client` | Vite compiles React bundle into `client/dist` without build errors or memory warnings. | **VERIFIED** |
| **G5** | **Secret Leakage Scan** | `git diff --staged; git diff` | Zero hardcoded passwords, tokens, API keys, or private keys in tracked files. | **VERIFIED** |
| **G6** | **Fail-Fast Config Check** | Server startup validation in `server/src/config/env.js` | Throws explicit error if `SESSION_SECRET` < 32 chars or `trustServerCertificate: true` in production. | **VERIFIED** |
| **G7** | **Database Schema Integrity** | Verify `database/schema.sql`, `views.sql`, `procedures.sql` | 9 tables in 3NF, clustered PKs, cascading FKs, check constraints, composite indexes. | **VERIFIED** |
| **G8** | **Health & Readiness Endpoints**| `GET /api/health`, `GET /api/health/ready` | HTTP 200 responses; database, storage, and Key Vault dependencies confirmed healthy without leaking secrets. | **VERIFIED** |

---

## 2. Release & Deployment Sequence

### Step 2.1: Local Build & Package Assembly
```bash
# 1. Clean previous build artifacts
rm -rf client/dist

# 2. Run static analysis
npm run lint:client

# 3. Execute all regression tests
npm test

# 4. Compile optimized frontend assets
npm run build:client

# 5. Verify production static asset directory
node -e "const fs = require('fs'); if (!fs.existsSync('client/dist/index.html')) process.exit(1);"
```

### Step 2.2: Cloud Infrastructure & Release Deployment (When Azure CLI is Available)
```powershell
# Windows PowerShell Deployment
az login
.\infra\azure\deploy.ps1 -ResourceGroupName "rg-leaklens-prod" -Location "eastus" -Prefix "leaklens" -Environment "prod"
```

```bash
# Linux / macOS Bash Deployment
az login
chmod +x ./infra/azure/deploy.sh
./infra/azure/deploy.sh "rg-leaklens-prod" "eastus" "leaklens" "prod"
```

---

## 3. Post-Deployment Smoke Test & Verification

1. **Liveness Verification:**
   ```bash
   curl -s -f "https://<app-name>.azurewebsites.net/api/health" | grep '"status":"healthy"'
   ```
2. **Readiness Verification:**
   ```bash
   curl -s -f "https://<app-name>.azurewebsites.net/api/health/ready" | grep '"ready":true'
   ```
3. **Security Headers Verification:**
   ```bash
   curl -s -I "https://<app-name>.azurewebsites.net" | grep -E "(X-Frame-Options|Content-Security-Policy|Strict-Transport-Security)"
   ```
4. **End-to-End Workflow Verification:**
   - Sign in as `admin@leaklens.local`.
   - Upload authorized synthetic test file.
   - Verify findings are masked in the UI and persisted to Azure SQL.
   - Escalate finding to incident, assign lead analyst, log remediation note, and execute atomic resolution (`sp_resolve_incident`).
   - Confirm audit log entry in `/api/audit-logs`.
   - Confirm analytics update in `/api/analytics/dashboard`.

---

## 4. Rollback & Contingency Plan

1. **App Service Rollback:**
   ```bash
   # Revert to previous deployment slot / release package
   az webapp deployment slot swap --resource-group rg-leaklens-prod --name <app-name> --slot staging --target-slot production
   ```
2. **Database Rollback:**
   - All migrations and schema definitions use idempotent, non-destructive statements (`IF OBJECT_ID(...) IS NULL`).
   - Relational rollback occurs automatically at transaction boundaries if any stored procedure step fails.
