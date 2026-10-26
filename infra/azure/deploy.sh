#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# LeakLens Automated Azure Cloud Deployment Pipeline (Bash)
# ==============================================================================

RESOURCE_GROUP="${1:-rg-leaklens-prod}"
LOCATION="${2:-eastus}"
PREFIX="${3:-leaklens}"
ENVIRONMENT="${4:-prod}"

echo "=========================================================="
echo "   LeakLens Automated Azure Cloud Deployment Pipeline     "
echo "=========================================================="

# 1. Verify Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "ERROR: Azure CLI ('az') is not installed or not in PATH."
    exit 1
fi

# 2. Verify Authentication Context
echo "[1/7] Checking Azure authentication state..."
if ! az account show &> /dev/null; then
    echo "ERROR: No active Azure session found. Run 'az login' first."
    exit 1
fi
echo "  Azure CLI authenticated."

# 3. Create or Verify Resource Group
echo "[2/7] Ensuring Resource Group '${RESOURCE_GROUP}' exists..."
az group create --name "${RESOURCE_GROUP}" --location "${LOCATION}" --output none
echo "  Resource group ready."

# 4. Prompt for SQL Administrator Password securely
read -s -p "Enter SQL Administrator Password (min 16 chars): " SQL_ADMIN_PASSWORD
echo ""

# 5. Execute Bicep Infrastructure Deployment
echo "[3/7] Provisioning Azure Infrastructure via Bicep template..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOYMENT_JSON=$(az deployment group create \
    --resource-group "${RESOURCE_GROUP}" \
    --template-file "${SCRIPT_DIR}/main.bicep" \
    --parameters prefix="${PREFIX}" environment="${ENVIRONMENT}" sqlAdminLogin="leaklens_admin" sqlAdminPassword="${SQL_ADMIN_PASSWORD}" \
    --output json)

APP_SERVICE_URL=$(echo "${DEPLOYMENT_JSON}" | jq -r '.properties.outputs.appServiceUrl.value')
APP_SERVICE_NAME=$(echo "${DEPLOYMENT_JSON}" | jq -r '.properties.outputs.appServiceName.value')
KEY_VAULT_NAME=$(echo "${DEPLOYMENT_JSON}" | jq -r '.properties.outputs.keyVaultUri.value' | sed -e 's|https://||' -e 's|\.vault\.azure\.net/||')

echo "  Infrastructure deployed: ${APP_SERVICE_URL}"

# 6. Seed Secrets in Key Vault
echo "[4/7] Generating and securing runtime secrets in Azure Key Vault..."
SESSION_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)

az keyvault secret set --vault-name "${KEY_VAULT_NAME}" --name "SESSION-SECRET" --value "${SESSION_SECRET}" --output none
az keyvault secret set --vault-name "${KEY_VAULT_NAME}" --name "JWT-SECRET" --value "${JWT_SECRET}" --output none
az keyvault secret set --vault-name "${KEY_VAULT_NAME}" --name "DB-PASSWORD" --value "${SQL_ADMIN_PASSWORD}" --output none
echo "  Secrets securely stored in Key Vault."

# 7. Build and Package Application
echo "[5/7] Building frontend and preparing deployment package..."
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
pushd "${REPO_ROOT}" > /dev/null

npm run build:client

ZIP_PATH="${REPO_ROOT}/leaklens-deploy.zip"
rm -f "${ZIP_PATH}"
zip -r "${ZIP_PATH}" server client/dist database package.json package-lock.json -x "**/node_modules/*" "**/.git/*"

# 8. Deploy Package to App Service
echo "[6/7] Deploying application package to App Service '${APP_SERVICE_NAME}'..."
az webapp deploy --resource-group "${RESOURCE_GROUP}" --name "${APP_SERVICE_NAME}" --src-path "${ZIP_PATH}" --type zip --output none
rm -f "${ZIP_PATH}"
popd > /dev/null
echo "  Deployment complete."

# 9. Health & Smoke Test Verification
echo "[7/7] Verifying live endpoints..."
sleep 15

curl -fsS "${APP_SERVICE_URL}/api/health" || echo "Warning: Health endpoint check timed out during boot."
echo ""
curl -fsS "${APP_SERVICE_URL}/api/health/ready" || echo "Warning: Readiness endpoint check timed out during boot."
echo ""

echo "=========================================================="
echo "   Deployment Complete: ${APP_SERVICE_URL}"
echo "=========================================================="
