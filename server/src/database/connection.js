import sql from 'mssql';
import env from '../config/env.js';

let poolPromise = null;
let activePool = null;
let cachedHealth = null;
let lastHealthCheckTime = 0;
let circuitBreakerOpenUntil = 0;

const HEALTH_CACHE_TTL_MS = 5000;
const CIRCUIT_BREAKER_COOLDOWN_MS = 15000;

// Transient error codes common to Azure SQL Database during failovers/throttling
const TRANSIENT_ERROR_CODES = new Set([
  4060, 40197, 40501, 40613, 49918, 49919, 49920, 11001
]);

/**
 * Builds MSSQL Connection Pool Configuration based on authentication mode.
 * Supports Azure Managed Identity (DefaultAzureCredential) or standard credentials.
 */
function buildSqlConfig() {
  const config = {
    server: env.DB.server,
    port: env.DB.port,
    database: env.DB.database,
    options: {
      encrypt: env.DB.options.encrypt,
      trustServerCertificate: env.DB.options.trustServerCertificate,
      connectTimeout: env.DB.options.connectTimeout,
      requestTimeout: env.DB.options.requestTimeout
    },
    pool: {
      max: env.DB.pool.max,
      min: env.DB.pool.min,
      idleTimeoutMillis: env.DB.pool.idleTimeoutMillis
    }
  };

  if (env.DB.authType === 'azure-active-directory-default') {
    config.authentication = {
      type: 'azure-active-directory-default'
    };
  } else {
    config.user = env.DB.user;
    config.password = env.DB.password;
  }

  return config;
}

const sqlConfig = buildSqlConfig();

/**
 * Resets the health cache and circuit breaker (e.g. for testing or explicit reconnect).
 */
export function resetHealthCache() {
  cachedHealth = null;
  lastHealthCheckTime = 0;
  circuitBreakerOpenUntil = 0;
}

/**
 * Fast synchronous check whether database pool is currently active and connected.
 * @returns {boolean}
 */
export function isDatabaseAvailable() {
  return Boolean(activePool && activePool.connected && Date.now() > circuitBreakerOpenUntil);
}

/**
 * Initializes and retrieves the singleton MSSQL Connection Pool.
 * @returns {Promise<sql.ConnectionPool>}
 */
export async function getPool() {
  if (activePool && activePool.connected) {
    return activePool;
  }

  // Circuit breaker: avoid hammering failing SQL server during cooldown
  if (Date.now() < circuitBreakerOpenUntil) {
    const remainingSec = Math.ceil((circuitBreakerOpenUntil - Date.now()) / 1000);
    const err = new Error(`Database connection circuit breaker active. Retry in ${remainingSec}s.`);
    err.code = 'CIRCUIT_BREAKER_ACTIVE';
    throw err;
  }

  if (!poolPromise) {
    const pool = new sql.ConnectionPool(sqlConfig);
    pool.on('error', err => {
      // Avoid leaking credentials in logs
      console.error('[MSSQL Pool Error]:', err.message);
    });

    poolPromise = pool
      .connect()
      .then(p => {
        activePool = p;
        circuitBreakerOpenUntil = 0;
        if (!env.IS_TEST) {
          console.log(`[MSSQL] Connected successfully to database: ${env.DB.database} on ${env.DB.server}:${env.DB.port} (Auth: ${env.DB.authType})`);
        }
        return p;
      })
      .catch(err => {
        poolPromise = null;
        activePool = null;
        circuitBreakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        if (!env.IS_TEST) {
          console.warn(`[MSSQL Connection Failed]: ${err.message}. Circuit breaker activated for ${CIRCUIT_BREAKER_COOLDOWN_MS / 1000}s. Proceeding in offline/degraded mode.`);
        }
        throw err;
      });
  }

  return poolPromise;
}

/**
 * Verifies live database connectivity using an active heartbeat query.
 * Cached with a 5s TTL to avoid redundant round-trips across repository calls.
 * Strictly avoids exposing connection strings or passwords.
 * 
 * @param {boolean} [force=false] - Force live bypass of the health cache
 * @returns {Promise<{ isHealthy: boolean, latencyMs?: number, message: string }>}
 */
export async function checkDatabaseHealth(force = false) {
  const now = Date.now();

  // Return cached result if within TTL and not explicitly forced
  if (!force && cachedHealth && (now - lastHealthCheckTime < HEALTH_CACHE_TTL_MS)) {
    return cachedHealth;
  }

  // If circuit breaker is open, return early without network timeout
  if (!force && now < circuitBreakerOpenUntil) {
    cachedHealth = {
      isHealthy: false,
      message: 'Database connectivity unreachable (circuit breaker active)'
    };
    lastHealthCheckTime = now;
    return cachedHealth;
  }

  const start = Date.now();
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 AS is_alive');
    const latencyMs = Date.now() - start;

    if (result && result.recordset && result.recordset[0]?.is_alive === 1) {
      cachedHealth = {
        isHealthy: true,
        latencyMs,
        message: 'Database operational'
      };
      lastHealthCheckTime = Date.now();
      return cachedHealth;
    }

    cachedHealth = {
      isHealthy: false,
      message: 'Database connectivity test returned unexpected response'
    };
    lastHealthCheckTime = Date.now();
    return cachedHealth;
  } catch (err) {
    cachedHealth = {
      isHealthy: false,
      message: err.code === 'CIRCUIT_BREAKER_ACTIVE'
        ? err.message
        : 'Database connectivity unreachable'
    };
    lastHealthCheckTime = Date.now();
    return cachedHealth;
  }
}

/**
 * Helper to determine if an error is transient and retryable.
 */
function isTransientError(err) {
  if (!err) return false;
  if (err.number && TRANSIENT_ERROR_CODES.has(err.number)) return true;
  if (['ETIMEOUT', 'ECONNRESET', 'ESOCKETTIMEDOUT'].includes(err.code)) return true;
  return false;
}

/**
 * Executes a parameterized query using the connection pool with transient retry support.
 * Prevents SQL injection by enforcing parameter binding.
 *
 * @param {string} queryString - T-SQL query text with @parameters
 * @param {Record<string, { type?: any, value: any } | any>} params - Parameter map
 * @param {number} [maxRetries=2] - Number of retry attempts on transient failure
 * @returns {Promise<sql.IResult<any>>}
 */
export async function executeQuery(queryString, params = {}, maxRetries = 2) {
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      const pool = await getPool();
      const request = pool.request();

      for (const [key, paramDef] of Object.entries(params)) {
        if (paramDef && typeof paramDef === 'object' && 'value' in paramDef) {
          if (paramDef.type) {
            request.input(key, paramDef.type, paramDef.value);
          } else {
            request.input(key, paramDef.value);
          }
        } else {
          request.input(key, paramDef);
        }
      }

      return await request.query(queryString);
    } catch (err) {
      attempt++;
      if (attempt <= maxRetries && isTransientError(err)) {
        const delayMs = Math.min(1000 * Math.pow(2, attempt), 4000);
        if (!env.IS_TEST) {
          console.warn(`[MSSQL Transient Error]: ${err.message}. Retrying query in ${delayMs}ms (attempt ${attempt}/${maxRetries})...`);
        }
        await new Promise(res => setTimeout(res, delayMs));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Gracefully terminates the MSSQL connection pool.
 */
export async function closePool() {
  if (activePool) {
    try {
      await activePool.close();
      activePool = null;
      poolPromise = null;
      if (!env.IS_TEST) {
        console.log('[MSSQL] Connection pool closed.');
      }
    } catch (err) {
      console.error('[MSSQL Pool Close Error]:', err.message);
    }
  }
}

export { sql };
export default {
  getPool,
  checkDatabaseHealth,
  resetHealthCache,
  isDatabaseAvailable,
  executeQuery,
  closePool,
  sql
};
