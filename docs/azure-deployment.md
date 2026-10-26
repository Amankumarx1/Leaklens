# LeakLens Azure Cloud Deployment Manual

This guide outlines the step-by-step procedure for deploying the **LeakLens Security Platform** to Microsoft Azure.

---

## 1. Prerequisites & Required Tools

Before initiating deployment, verify that the following tools are installed on your workstation:

1. **Azure CLI (`az`):** Version 2.50+ (`az --version`).
2. **Node.js:** Version 20.x LTS or higher (`node -v`).
3. **Git:** Version 2.40+ (`git -v`).
4. **Active Azure Subscription:** With Contributor or Owner role permissions on the target Resource Group.

```bash
# Verify authentication and selected subscription
az login
az account show --output table
```

---

## 2. Resource Sizing & Cost-Control Guidelines

LeakLens is optimized for free-tier eligibility and academic student credit budgets:

| Service | Proposed Tier | Cost Estimate | Free Tier Eligibility |
| :--- | :--- | :--- | :--- |
| **Azure App Service Plan** | Linux B1 (or F1 Free) | ~$12/month (B1) or $0 (F1) | F1 free tier supports 60 CPU minutes/day. B1 recommended for persistent memory. |
| **Azure SQL Database** | Basic Tier (5 DTU, 2GB) | ~$4.99/month | Covered under Azure for Students / 12-month free services. |
| **Azure Blob Storage** | Standard LRS (Hot Tier) | <$0.50/month (<5GB) | 5GB free storage for 12 months with Azure free account. |
| **Azure Key Vault** | Standard Tier | <$0.10/month | Free tier operations allowance. |

---

## 3. Automated Deployment via Bicep

The repository includes a modular Infrastructure-as-Code (IaC) Bicep template under `infra/azure/main.bicep`.

### Step 3.1: Run the Deployment Script

**On Windows (PowerShell):**
```powershell
.\infra\azure\deploy.ps1 -ResourceGroupName "rg-leaklens-prod" -Location "eastus" -Prefix "leaklens" -Environment "prod"
```

**On Linux / macOS (Bash):**
```bash
chmod +x ./infra/azure/deploy.sh
./infra/azure/deploy.sh "rg-leaklens-prod" "eastus" "leaklens" "prod"
```

The automated script performs the following tasks:
1. Validates the Azure CLI login session.
2. Creates the Resource Group if it does not already exist.
3. Provisions the Storage Account, Key Vault, Azure SQL Server, App Service Plan, and App Service via Bicep.
4. Enables the System-Assigned Managed Identity on App Service.
5. Assigns RBAC roles (`Storage Blob Data Contributor` and `Key Vault Secrets User`).
6. Generates high-entropy secrets and stores them directly into Azure Key Vault.
7. Compiles the React frontend production bundle.
8. Creates a clean deployment package and deploys it to Azure App Service via `az webapp deploy`.
9. Executes post-deployment smoke tests against `/api/health` and `/api/health/ready`.

---

## 4. Manual Step-by-Step Deployment (Alternative)

If you prefer to execute the individual steps manually:

### Step 4.1: Create Resource Group
```bash
az group create --name rg-leaklens-prod --location eastus
```

### Step 4.2: Deploy Bicep Infrastructure
```bash
az deployment group create \
  --resource-group rg-leaklens-prod \
  --template-file infra/azure/main.bicep \
  --parameters prefix=leaklens environment=prod sqlAdminLogin=leaklens_admin
```

### Step 4.3: Store Runtime Secrets in Key Vault
```bash
VAULT_NAME=$(az keyvault list --resource-group rg-leaklens-prod --query "[0].name" -o tsv)

# Generate 64-character random secrets
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

az keyvault secret set --vault-name "$VAULT_NAME" --name "SESSION-SECRET" --value "$SESSION_SECRET"
az keyvault secret set --vault-name "$VAULT_NAME" --name "JWT-SECRET" --value "$JWT_SECRET"
```

### Step 4.4: Execute Database Migrations
Connect to the Azure SQL Database using SQL Server Management Studio (SSMS), Azure Data Studio, or `sqlcmd`, and execute `database/schema.sql`:

```bash
sqlcmd -S "<sql-server-name>.database.windows.net" \
       -d "LeakLensDB" \
       -U "leaklens_admin" \
       -P "<your-password>" \
       -i "database/schema.sql"
```

### Step 4.5: Build & Deploy Application Package
```bash
# Build frontend
npm run build:client

# Package application (excluding node_modules)
zip -r deploy.zip server client/dist database package.json package-lock.json -x "**/node_modules/*" "**/.git/*"

# Deploy to App Service
APP_NAME=$(az webapp list --resource-group rg-leaklens-prod --query "[0].name" -o tsv)
az webapp deploy --resource-group rg-leaklens-prod --name "$APP_NAME" --src-path deploy.zip --type zip
```

---

## 5. Post-Deployment Verification & Smoke Testing

### 5.1 Verify Liveness & Readiness Probes
```bash
APP_URL=$(az webapp show --resource-group rg-leaklens-prod --name "$APP_NAME" --query "defaultHostName" -o tsv)

# Liveness Probe (HTTP 200)
curl -s -i "https://${APP_URL}/api/health"

# Readiness Probe (HTTP 200 when SQL & Storage are ready)
curl -s -i "https://${APP_URL}/api/health/ready"
```

### 5.2 Authenticated Workflow Smoke Test
1. Open `https://${APP_URL}` in your web browser. Confirm HTTPS is enforced with a valid certificate.
2. Log in using the provisioned default administrator account (`admin@leaklens.local` / `Admin@LeakLens2026!`).
3. Upload an authorized test file (e.g., CSV containing masked test credentials).
4. Verify that the file is stored in private Azure Blob Storage (`leaklens-scans`), scanned, and persisted in Azure SQL with masked excerpts.
5. Create an incident from a finding, assign it to an analyst, add a remediation note, and resolve it using the verified workflow.

---

## 6. Troubleshooting & Diagnostics

| Symptom | Probable Cause | Diagnostic Command / Resolution |
| :--- | :--- | :--- |
| **503 Service Unavailable on `/api/health/ready`** | Azure SQL firewall blocking App Service outbound IP | Check `az webapp show -g rg-leaklens-prod -n $APP_NAME --query "outboundIpAddresses"`. Ensure `AllowAllWindowsAzureIps` rule is enabled in SQL server firewall. |
| **Storage Upload Fails (`403 Forbidden`)** | Managed identity missing role assignment | Run `az role assignment list --assignee <app-identity-id>` and confirm `Storage Blob Data Contributor` is assigned on the Storage Account. |
| **App Service shows Node.js default landing page** | Application failed to start or wrong startup command | Inspect logs: `az webapp log tail --resource-group rg-leaklens-prod --name $APP_NAME`. Verify startup command is `npm start`. |
| **Client-side navigation produces 404** | Missing SPA wildcard fallback in Express | Verified in `server/src/app.js` using `app.get('*', ... res.sendFile('index.html'))`. |

---

## 7. Rollback Considerations

1. **Application Rollback:** App Service maintains deployment history. To roll back to a previous deployment slot or zip package:
   ```bash
   az webapp deployment list-publishing-profiles --name $APP_NAME --resource-group rg-leaklens-prod
   ```
2. **Database Rollback:** The `database/schema.sql` uses non-destructive `IF OBJECT_ID(...) IS NULL` checks. Avoid dropping tables during rollback to prevent data loss.

---

## 8. Clean-Up Instructions (Tear-Down)

To avoid incurring recurring charges when testing is completed:

```bash
# Delete all resources in the dedicated resource group
az group delete --name rg-leaklens-prod --yes --no-wait
```
*Note: Ensure you only target the dedicated resource group created for LeakLens (`rg-leaklens-prod`), never a shared or university-wide group.*
