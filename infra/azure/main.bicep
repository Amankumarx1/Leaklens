@description('Deployment region for all LeakLens resources')
param location string = resourceGroup().location

@description('Prefix for resource naming to avoid collisions across subscriptions')
@minLength(3)
@maxLength(16)
param prefix string = 'leaklens'

@description('Deployment environment tier')
@allowed([
  'dev'
  'test'
  'prod'
])
param environment string = 'prod'

@description('App Service Plan pricing tier (academic/cost-optimized B1 or F1)')
param appServicePlanSku string = 'B1'

@description('Azure SQL Database DTU / Tier (Basic 5 DTU for lowest cost)')
param sqlDatabaseSku string = 'Basic'

@description('Administrator login name for SQL Server (used as bootstrap admin)')
@secure()
param sqlAdminLogin string

@description('Administrator password for SQL Server')
@secure()
param sqlAdminPassword string

// Unique suffix for globally distinct resources (Storage Accounts, Key Vaults)
var uniqueSuffix = uniqueString(resourceGroup().id)
var appServicePlanName = '${prefix}-asp-${environment}'
var appServiceName = '${prefix}-app-${uniqueSuffix}'
var storageAccountName = take('${prefix}st${uniqueSuffix}', 24)
var keyVaultName = take('${prefix}-kv-${uniqueSuffix}', 24)
var sqlServerName = '${prefix}-sql-${uniqueSuffix}'
var sqlDatabaseName = 'LeakLensDB'
var storageContainerName = 'leaklens-scans'

// RBAC Role Definition IDs
// Storage Blob Data Contributor
var storageBlobDataContributorRoleId = 'ba92f5b4-2d11-453d-a403-e96b0029c9fe'
// Key Vault Secrets User
var keyVaultSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'

// ==============================================================================
// 1. STORAGE ACCOUNT (Private Object Storage)
// ==============================================================================
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false // Strict zero public access
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    accessTier: 'Hot'
    encryption: {
      services: {
        blob: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

resource blobServices 'Microsoft.Storage/storageAccounts/blobServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    deleteRetentionPolicy: {
      enabled: true
      days: 14
    }
  }
}

resource scanContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2023-05-01' = {
  parent: blobServices
  name: storageContainerName
  properties: {
    publicAccess: 'None' // Container is completely private
  }
}

// ==============================================================================
// 2. AZURE KEY VAULT (Secret Management with Azure RBAC)
// ==============================================================================
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enableRbacAuthorization: true // Enforce least-privilege Azure RBAC
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
    networkAcls: {
      bypass: 'AzureServices'
      defaultAction: 'Allow'
    }
  }
}

// ==============================================================================
// 3. AZURE SQL SERVER & DATABASE
// ==============================================================================
resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

// Allow Azure Services (App Service) to route through firewall
resource sqlFirewallRuleAzureServices 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAllWindowsAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  sku: {
    name: sqlDatabaseSku
    tier: sqlDatabaseSku
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648 // 2 GB limit for cost control
  }
}

// ==============================================================================
// 4. APP SERVICE PLAN & LINUX WEB APP
// ==============================================================================
resource appServicePlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appServicePlanName
  location: location
  kind: 'linux'
  properties: {
    reserved: true // Required for Linux hosting
  }
  sku: {
    name: appServicePlanSku
  }
}

resource appService 'Microsoft.Web/sites@2023-12-01' = {
  name: appServiceName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned' // Generates Managed Identity for service-to-service auth
  }
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true // Force HTTPS
    clientAffinityEnabled: false
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: (appServicePlanSku != 'F1')
      ftpsState: 'Disabled' // Block plain text / insecure FTP access
      minTlsVersion: '1.2'
      http20Enabled: true
      appCommandLine: 'npm start'
      appSettings: [
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          name: 'AZURE_STORAGE_ACCOUNT_NAME'
          value: storageAccount.name
        }
        {
          name: 'AZURE_STORAGE_CONTAINER_NAME'
          value: storageContainerName
        }
        {
          name: 'AZURE_KEYVAULT_NAME'
          value: keyVault.name
        }
        {
          name: 'KEY_VAULT_URI'
          value: keyVault.properties.vaultUri
        }
        {
          name: 'DB_SERVER'
          value: '${sqlServer.name}.database.windows.net'
        }
        {
          name: 'DB_NAME'
          value: sqlDatabaseName
        }
        {
          name: 'AZURE_SQL_AUTH_TYPE'
          value: 'azure-active-directory-default'
        }
        {
          name: 'DB_TRUST_SERVER_CERTIFICATE'
          value: 'false'
        }
        {
          name: 'DB_ENCRYPT'
          value: 'true'
        }
        {
          name: 'WEBSITE_RUN_FROM_PACKAGE'
          value: '1'
        }
      ]
    }
  }
}

// ==============================================================================
// 5. MANAGED IDENTITY RBAC ROLE ASSIGNMENTS
// ==============================================================================

// Grant App Service Managed Identity 'Storage Blob Data Contributor' on the Storage Account
resource roleAssignmentStorage 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(storageAccount.id, appService.id, storageBlobDataContributorRoleId)
  scope: storageAccount
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', storageBlobDataContributorRoleId)
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Grant App Service Managed Identity 'Key Vault Secrets User' on the Key Vault
resource roleAssignmentKeyVault 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appService.id, keyVaultSecretsUserRoleId)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsUserRoleId)
    principalId: appService.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

// Output deployed endpoints and resource names for automation scripts
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output appServiceName string = appService.name
output managedIdentityPrincipalId string = appService.identity.principalId
output storageAccountName string = storageAccount.name
output keyVaultUri string = keyVault.properties.vaultUri
output sqlServerFqdn string = '${sqlServer.name}.database.windows.net'
output sqlDatabaseName string = sqlDatabaseName
