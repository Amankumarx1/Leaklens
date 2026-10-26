/**
 * SSRF and Parameter Syntax Validator for Azure Integrations
 * Enforces strict hostname allowlists, HTTPS transport, and RFC resource naming.
 */

const ALLOWED_POWER_BI_HOSTNAMES = new Set([
  'app.powerbi.com',
  'powerbi.com',
  'msit.powerbi.com'
]);

// Reserved and private IPv4 / IPv6 subnets for SSRF blocking
const PRIVATE_IP_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // Link-local / Azure IMDS
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i
];

/**
 * Validates Power BI report URL with strict SSRF defense.
 * @param {string} urlString - Candidate Power BI Report URL
 * @returns {{ valid: boolean, error?: string, parsedUrl?: URL }}
 */
export function validatePowerBiUrl(urlString) {
  if (!urlString || typeof urlString !== 'string') {
    return { valid: false, error: 'Power BI report URL is required.' };
  }

  const trimmed = urlString.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Malformed URL format. Expected full HTTPS URL.' };
  }

  if (parsed.protocol !== 'https:') {
    return { valid: false, error: 'Insecure protocol. Power BI report URL must use HTTPS.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Check for localhost or private IP addresses
  if (hostname === 'localhost' || PRIVATE_IP_PATTERNS.some(pat => pat.test(hostname))) {
    return { valid: false, error: 'SSRF Protection: Access to loopback, link-local, or private network addresses is forbidden.' };
  }

  // Check against allowed Power BI domains (*.powerbi.com)
  const isAllowed = ALLOWED_POWER_BI_HOSTNAMES.has(hostname) || hostname.endsWith('.powerbi.com');
  if (!isAllowed) {
    return { valid: false, error: `Invalid Power BI host "${hostname}". Only official Power BI domains (*.powerbi.com) are permitted.` };
  }

  return { valid: true, parsedUrl: parsed };
}

/**
 * Validates Azure SQL Server hostname syntax.
 * @param {string} hostname
 * @param {boolean} [isProduction=false]
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateSqlHostname(hostname, isProduction = false) {
  if (!hostname || typeof hostname !== 'string') {
    return { valid: false, error: 'SQL server hostname is required.' };
  }

  const trimmed = hostname.trim().toLowerCase();

  if (trimmed === 'localhost' || trimmed === '127.0.0.1') {
    if (isProduction) {
      return { valid: false, error: 'Localhost SQL connection is forbidden in production environments.' };
    }
    return { valid: true };
  }

  // Must end with .database.windows.net or .database.azure.com
  const isAzureSql = trimmed.endsWith('.database.windows.net') || trimmed.endsWith('.database.azure.com');
  if (!isAzureSql) {
    return { valid: false, error: `Invalid Azure SQL hostname "${trimmed}". Must end with .database.windows.net` };
  }

  // Must not have forbidden characters
  if (!/^[a-z0-9.-]+$/.test(trimmed)) {
    return { valid: false, error: 'SQL hostname contains illegal characters.' };
  }

  return { valid: true };
}

/**
 * Validates Azure Storage Account Name syntax (3-24 lowercase alphanumeric).
 * @param {string} accountName
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateStorageAccountName(accountName) {
  if (!accountName || typeof accountName !== 'string') {
    return { valid: false, error: 'Storage account name is required.' };
  }

  const trimmed = accountName.trim();
  if (!/^[a-z0-9]{3,24}$/.test(trimmed)) {
    return { valid: false, error: 'Storage account name must be 3-24 characters containing only lowercase letters and numbers.' };
  }

  return { valid: true };
}

/**
 * Validates Azure Blob Storage container name.
 * @param {string} containerName
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateContainerName(containerName) {
  if (!containerName || typeof containerName !== 'string') {
    return { valid: false, error: 'Container name is required.' };
  }

  const trimmed = containerName.trim();
  if (!/^[a-z0-9]([a-z0-9-]{1,61}[a-z0-9])?$/.test(trimmed)) {
    return { valid: false, error: 'Container name must be 3-63 characters, lowercase letters, numbers, or dashes.' };
  }

  return { valid: true };
}

/**
 * Validates Azure Key Vault URI or name.
 * @param {string} vaultInput
 * @returns {{ valid: boolean, error?: string, vaultUri?: string }}
 */
export function validateKeyVaultInput(vaultInput) {
  if (!vaultInput || typeof vaultInput !== 'string') {
    return { valid: false, error: 'Key Vault identifier or URI is required.' };
  }

  const trimmed = vaultInput.trim();

  // If it's a URI
  if (trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      const hostname = parsed.hostname.toLowerCase();
      if (!hostname.endsWith('.vault.azure.net') && !hostname.endsWith('.vault.usgovcloudapi.net')) {
        return { valid: false, error: `Invalid Key Vault host "${hostname}". Must end with .vault.azure.net` };
      }
      return { valid: true, vaultUri: `https://${hostname}` };
    } catch {
      return { valid: false, error: 'Invalid Key Vault URL syntax.' };
    }
  }

  // If it's a raw vault name
  if (/^[a-zA-Z0-9-]{3,24}$/.test(trimmed)) {
    return { valid: true, vaultUri: `https://${trimmed.toLowerCase()}.vault.azure.net` };
  }

  return { valid: false, error: 'Key Vault name must be 3-24 alphanumeric characters or dashes.' };
}

export default {
  validatePowerBiUrl,
  validateSqlHostname,
  validateStorageAccountName,
  validateContainerName,
  validateKeyVaultInput
};
