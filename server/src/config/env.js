import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve project root .env if present
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

/**
 * Validates required configuration keys.
 * Fails fast on invalid or missing production settings rather than substituting insecure defaults.
 */
function validateConfig() {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const errors = [];

  // Port validation
  const port = parseInt(process.env.PORT || '3000', 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT configuration: "${process.env.PORT}". Must be an integer between 1 and 65535.`);
  }

  // Production security checks
  if (nodeEnv === 'production') {
    if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
      errors.push('SESSION_SECRET is required in production and must be at least 32 characters in length.');
    }

    if (!process.env.DB_SERVER) {
      errors.push('DB_SERVER is required in production.');
    }

    if (!process.env.DB_NAME) {
      errors.push('DB_NAME is required in production.');
    }

    // Support Entra Managed Identity (azure-active-directory-default) as primary auth
    const isEntraAuth = process.env.AZURE_SQL_AUTH_TYPE === 'azure-active-directory-default';
    if (!isEntraAuth) {
      if (!process.env.DB_USER) {
        errors.push('DB_USER is required in production when not using Azure Entra Managed Identity.');
      }

      if (!process.env.DB_PASSWORD) {
        errors.push('DB_PASSWORD is required in production when not using Azure Entra Managed Identity.');
      }
    }

    // In production, TLS certificate trust must not be blindly disabled
    if (process.env.DB_TRUST_SERVER_CERTIFICATE === 'true') {
      errors.push(
        'SECURITY RISK: DB_TRUST_SERVER_CERTIFICATE cannot be "true" in production. Valid TLS certificates must be verified.'
      );
    }
  }

  if (errors.length > 0) {
    const message = `[LeakLens Config Validation Failed]:\n - ${errors.join('\n - ')}`;
    // Fail immediately on configuration failure
    throw new Error(message);
  }
}

// Execute validation on module import
validateConfig();

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_TEST: process.env.NODE_ENV === 'test',
  PORT: parseInt(process.env.PORT || '3000', 10),
  CLIENT_URL: process.env.CLIENT_URL || 'http://localhost:5173',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-insecure-secret-leaklens-32chars-min-key',
  DB: {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    database: process.env.DB_NAME || 'LeakLensDB',
    user: process.env.DB_USER || 'leaklens_app',
    password: process.env.DB_PASSWORD || '',
    authType: process.env.AZURE_SQL_AUTH_TYPE || (process.env.NODE_ENV === 'production' && !process.env.DB_PASSWORD ? 'azure-active-directory-default' : 'default'),
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true' || process.env.NODE_ENV === 'production',
      trustServerCertificate: process.env.NODE_ENV === 'production'
        ? false
        : process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
      connectTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '15000', 10),
      requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000', 10)
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      min: parseInt(process.env.DB_POOL_MIN || '1', 10),
      idleTimeoutMillis: 30000
    }
  },
  AZURE: {
    STORAGE_ACCOUNT_NAME: process.env.AZURE_STORAGE_ACCOUNT_NAME || '',
    STORAGE_CONTAINER_NAME: process.env.AZURE_STORAGE_CONTAINER_NAME || 'leaklens-scans',
    STORAGE_CONNECTION_STRING: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
    KEYVAULT_NAME: process.env.AZURE_KEYVAULT_NAME || '',
    KEY_VAULT_URI: process.env.KEY_VAULT_URI || '',
    APP_INSIGHTS_CONNECTION_STRING: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || ''
  }
};

export default env;
