<#
.SYNOPSIS
    Automated Azure Deployment Script for LeakLens.
.DESCRIPTION
    Validates Azure CLI session, provisions Bicep infrastructure, seeds Azure Key Vault secrets,
    deploys the production application package, and verifies health probes.
.EXAMPLE
    .\deploy.ps1 -ResourceGroupName "rg-leaklens-prod" -Location "eastus"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ResourceGroupName,

    [Parameter(Mandatory = $false)]
    [string]$Location = "eastus",

    [Parameter(Mandatory = $false)]
    [string]$Prefix = "leaklens",

    [Parameter(Mandatory = $false)]
    [string]$Environment = "prod",

    [Parameter(Mandatory = $false)]
    [securestring]$SqlAdminPassword
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   LeakLens Automated Azure Cloud Deployment Pipeline     " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verify Azure CLI is installed
if (-not (Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Error "Azure CLI ('az') is not installed or not in PATH. Please install Azure CLI before deploying."
    exit 1
}

# 2. Verify Authentication Context
Write-Host "[1/7] Checking Azure authentication state..." -ForegroundColor Yellow
$account = az account show --query "{subscription:name, id:id, user:user.name}" -o json | ConvertFrom-Json
if (-not $account) {
    Write-Error "No active Azure session found. Run 'az login' first."
    exit 1
}
Write-Host "  Authenticated as: $($account.user) (Subscription: $($account.subscription))" -ForegroundColor Green

# 3. Create or Verify Resource Group
Write-Host "[2/7] Ensuring Resource Group '$ResourceGroupName' exists in '$Location'..." -ForegroundColor Yellow
az group create --name $ResourceGroupName --location $Location --output none
Write-Host "  Resource Group '$ResourceGroupName' ready." -ForegroundColor Green

# 4. Handle SQL Password Securely
if (-not $SqlAdminPassword) {
    $rawPassword = Read-Host "Enter SQL Administrator Password (Min 16 chars, mixed case, digits, symbols)" -AsSecureString
    $SqlAdminPassword = $rawPassword
}
$bstr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($SqlAdminPassword)
$plainSqlPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($bstr)

# 5. Execute Bicep Infrastructure Deployment
Write-Host "[3/7] Provisioning Azure Infrastructure via Bicep template..." -ForegroundColor Yellow
$templatePath = Join-Path $PSScriptRoot "main.bicep"

$deploymentJson = az deployment group create `
    --resource-group $ResourceGroupName `
    --template-file $templatePath `
    --parameters prefix=$Prefix environment=$Environment sqlAdminLogin="leaklens_admin" sqlAdminPassword=$plainSqlPassword `
    --output json

$deployment = $deploymentJson | ConvertFrom-Json
$outputs = $deployment.properties.outputs

$appServiceUrl = $outputs.appServiceUrl.value
$appServiceName = $outputs.appServiceName.value
$keyVaultUri = $outputs.keyVaultUri.value
$storageAccount = $outputs.storageAccountName.value
$sqlServerFqdn = $outputs.sqlServerFqdn.value

Write-Host "  Infrastructure deployed successfully!" -ForegroundColor Green
Write-Host "  App Service URL: $appServiceUrl" -ForegroundColor Cyan

# 6. Seed Application Secrets in Key Vault
Write-Host "[4/7] Generating and securing runtime secrets in Azure Key Vault..." -ForegroundColor Yellow
$sessionSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})
$jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 64 | ForEach-Object {[char]$_})

$kvName = $outputs.keyVaultUri.value -replace "https://", "" -replace "\.vault\.azure\.net/", ""
az keyvault secret set --vault-name $kvName --name "SESSION-SECRET" --value $sessionSecret --output none
az keyvault secret set --vault-name $kvName --name "JWT-SECRET" --value $jwtSecret --output none
az keyvault secret set --vault-name $kvName --name "DB-PASSWORD" --value $plainSqlPassword --output none
Write-Host "  Secrets seeded in Key Vault." -ForegroundColor Green

# 7. Build and Package Application
Write-Host "[5/7] Building frontend and preparing deployment package..." -ForegroundColor Yellow
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "../..")
Push-Location $repoRoot

npm run build:client

# Create zip package excluding local node_modules
$zipPath = Join-Path $repoRoot "leaklens-deploy.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

Write-Host "  Creating ZIP archive for App Service..."
Compress-Archive -Path "server", "client/dist", "database", "package.json", "package-lock.json" -DestinationPath $zipPath -Force

# 8. Deploy Package to App Service
Write-Host "[6/7] Deploying package to App Service '$appServiceName'..." -ForegroundColor Yellow
az webapp deploy --resource-group $ResourceGroupName --name $appServiceName --src-path $zipPath --type zip --output none
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Pop-Location
Write-Host "  Deployment package uploaded successfully." -ForegroundColor Green

# 9. Health & Smoke Test Verification
Write-Host "[7/7] Verifying live endpoints..." -ForegroundColor Yellow
Start-Sleep -Seconds 15

$healthUrl = "$appServiceUrl/api/health"
$readyUrl = "$appServiceUrl/api/health/ready"

try {
    $healthRes = Invoke-RestMethod -Uri $healthUrl -Method Get -TimeoutSec 30
    Write-Host "  Liveness Probe (/api/health): Status = $($healthRes.data.status)" -ForegroundColor Green

    $readyRes = Invoke-RestMethod -Uri $readyUrl -Method Get -TimeoutSec 30
    Write-Host "  Readiness Probe (/api/health/ready): Ready = $($readyRes.ready)" -ForegroundColor Green
} catch {
    Write-Warning "Health verification warning: $($_.Exception.Message). Service may still be initializing."
}

Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   Deployment Complete: $appServiceUrl" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
