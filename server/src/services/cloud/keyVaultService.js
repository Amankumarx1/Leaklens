import { DefaultAzureCredential } from '@azure/identity';
import { SecretClient } from '@azure/keyvault-secrets';

/**
 * Key Vault Service
 * Manages runtime retrieval of sensitive application secrets using
 * Azure Managed Identity (DefaultAzureCredential).
 * Implements in-memory caching to minimize external API roundtrips
 * and safe fallback for local/test execution.
 */

const secretCache = new Map();
let secretClient = null;
let isKeyVaultConfigured = false;

/**
 * Resolves the Key Vault URI from environment variables.
 * @returns {string|null}
 */
export function getKeyVaultUri() {
  if (process.env.KEY_VAULT_URI) {
    return process.env.KEY_VAULT_URI;
  }
  if (process.env.AZURE_KEYVAULT_NAME) {
    return `https://${process.env.AZURE_KEYVAULT_NAME}.vault.azure.net`;
  }
  return null;
}

/**
 * Initializes the Key Vault client if configuration is present.
 */
function initKeyVaultClient() {
  if (secretClient !== null) {
    return secretClient;
  }

  const vaultUri = getKeyVaultUri();
  if (vaultUri) {
    try {
      const credential = new DefaultAzureCredential();
      secretClient = new SecretClient(vaultUri, credential);
      isKeyVaultConfigured = true;
      if (process.env.NODE_ENV !== 'test') {
        console.log(`[KeyVault] Client initialized for vault: ${vaultUri}`);
      }
    } catch (err) {
      console.warn(`[KeyVault] Initialization failed: ${err.message}. Relying on local environment.`);
      isKeyVaultConfigured = false;
    }
  } else {
    isKeyVaultConfigured = false;
  }

  return secretClient;
}

/**
 * Retrieves a secret value by name.
 * 1. Checks in-memory cache.
 * 2. If Key Vault is configured, attempts retrieval via Azure SDK.
 * 3. Falls back to process.env[secretName] or specified fallback.
 *
 * @param {string} secretName - Name of the secret in Key Vault (e.g., 'SESSION-SECRET' or 'DB-PASSWORD')
 * @param {string} [fallbackEnvVar] - Optional environment variable name to fall back to
 * @returns {Promise<string|null>}
 */
export async function getSecret(secretName, fallbackEnvVar = null) {
  // Check cache first
  if (secretCache.has(secretName)) {
    return secretCache.get(secretName);
  }

  const client = initKeyVaultClient();

  if (isKeyVaultConfigured && client) {
    try {
      // Azure Key Vault secret names only allow alphanumeric and dashes
      const sanitizedName = secretName.replace(/_/g, '-');
      const secret = await client.getSecret(sanitizedName);
      if (secret && secret.value) {
        secretCache.set(secretName, secret.value);
        return secret.value;
      }
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') {
        // Redact any sensitive details in error message
        console.warn(`[KeyVault] Failed to retrieve secret "${secretName}": ${err.code || err.message}. Checking environment fallback.`);
      }
    }
  }

  // Fallback to environment variable
  const envKey = fallbackEnvVar || secretName.replace(/-/g, '_');
  const envVal = process.env[envKey] || null;

  if (envVal) {
    secretCache.set(secretName, envVal);
    return envVal;
  }

  return null;
}

/**
 * Clears the secret cache (primarily for unit/integration testing).
 */
export function clearSecretCache() {
  secretCache.clear();
}

/**
 * Sets a mock secret in cache (for testing without Azure credentials).
 * @param {string} secretName
 * @param {string} value
 */
export function setCachedSecret(secretName, value) {
  secretCache.set(secretName, value);
}

/**
 * Checks Key Vault service health/readiness.
 * @returns {Promise<{ isHealthy: boolean, configured: boolean, message: string }>}
 */
export async function checkKeyVaultHealth() {
  const vaultUri = getKeyVaultUri();
  if (!vaultUri) {
    return {
      isHealthy: true,
      configured: false,
      message: 'Key Vault not configured (using local environment secrets)'
    };
  }

  try {
    const client = initKeyVaultClient();
    if (!client) {
      return {
        isHealthy: false,
        configured: true,
        message: 'Key Vault client failed to initialize'
      };
    }
    return {
      isHealthy: true,
      configured: true,
      message: 'Key Vault client ready'
    };
  } catch (err) {
    return {
      isHealthy: false,
      configured: true,
      message: 'Key Vault health check failed'
    };
  }
}

export default {
  getKeyVaultUri,
  getSecret,
  clearSecretCache,
  setCachedSecret,
  checkKeyVaultHealth
};
