import sql from 'mssql';
import env from '../config/env.js';

let poolPromise = null;
let activePool = null;

/**
 * MSSQL Connection Pool Configuration
 */
const sqlConfig = {
  server: env.DB.server,
  port: env.DB.port,
  database: env.DB.database,
  user: env.DB.user,
  password: env.DB.password,
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

/**
 * Initializes and retrieves the singleton MSSQL Connection Pool.
 * @returns {Promise<sql.ConnectionPool>}
 */
export async function getPool() {
  if (activePool && activePool.connected) {
    return activePool;
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
        if (!env.IS_TEST) {
          console.log(`[MSSQL] Connected successfully to database: ${env.DB.database} on ${env.DB.server}:${env.DB.port}`);
        }
        return p;
      })
      .catch(err => {
        poolPromise = null;
        activePool = null;
        if (!env.IS_TEST) {
          console.warn(`[MSSQL Connection Failed]: ${err.message}. Proceeding in offline/degraded mode.`);
        }
        throw err;
      });
  }

  return poolPromise;
}

/**
 * Verifies live database connectivity using an active heartbeat query.
 * Strictly avoids exposing connection strings or passwords.
 * 
 * @returns {Promise<{ isHealthy: boolean, latencyMs?: number, message: string }>}
 */
export async function checkDatabaseHealth() {
  const start = Date.now();
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 AS is_alive');
    const latencyMs = Date.now() - start;

    if (result && result.recordset && result.recordset[0]?.is_alive === 1) {
      return {
        isHealthy: true,
        latencyMs,
        message: 'Database operational'
      };
    }

    return {
      isHealthy: false,
      message: 'Database connectivity test returned unexpected response'
    };
  } catch (err) {
    return {
      isHealthy: false,
      message: 'Database connectivity unreachable'
    };
  }
}

/**
 * Executes a parameterized query using the connection pool.
 * Prevents SQL injection by enforcing parameter binding.
 *
 * @param {string} queryString - T-SQL query text with @parameters
 * @param {Record<string, { type?: any, value: any } | any>} params - Parameter map
 * @returns {Promise<sql.IResult<any>>}
 */
export async function executeQuery(queryString, params = {}) {
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

  return request.query(queryString);
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
  executeQuery,
  closePool,
  sql
};
