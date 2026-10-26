import createApp from './app.js';
import env from './config/env.js';
import { checkDatabaseHealth, closePool } from './database/connection.js';
import { checkStorageHealth } from './services/storage/blobStorageService.js';
import { checkKeyVaultHealth } from './services/cloud/keyVaultService.js';

const app = createApp();
const HOST = '0.0.0.0';

const server = app.listen(env.PORT, HOST, async () => {
  console.log(`=======================================================`);
  console.log(`  LeakLens Security Platform — Server Initialized`);
  console.log(`  Environment : ${env.NODE_ENV}`);
  console.log(`  Host:Port   : ${HOST}:${env.PORT}`);
  console.log(`  Health API  : http://${HOST}:${env.PORT}/api/health`);
  console.log(`  Ready API   : http://${HOST}:${env.PORT}/api/health/ready`);
  console.log(`  Client URL  : ${env.CLIENT_URL}`);
  console.log(`=======================================================`);

  // Initial non-blocking dependency connectivity checks
  try {
    const dbStatus = await checkDatabaseHealth();
    if (dbStatus.isHealthy) {
      console.log(`[Database] Initial connectivity check: HEALTHY (${dbStatus.latencyMs}ms)`);
    } else {
      console.warn(`[Database] Initial connectivity check: ${dbStatus.message}`);
    }

    const storageStatus = await checkStorageHealth();
    console.log(`[Storage] Initial status: ${storageStatus.message} (Container: ${storageStatus.container})`);

    const kvStatus = await checkKeyVaultHealth();
    console.log(`[KeyVault] Initial status: ${kvStatus.message}`);
  } catch (err) {
    console.warn(`[Diagnostics] Startup checks encountered notice: ${err.message}`);
  }
});

// Graceful Shutdown Management
let isShuttingDown = false;

async function handleGracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\nReceived ${signal}. Initiating graceful shutdown...`);

  // Close HTTP server to stop accepting new requests
  server.close(async () => {
    console.log('[Server] HTTP server stopped accepting connections.');

    // Close MSSQL connection pool
    try {
      await closePool();
      console.log('[Database] Database pool successfully drained.');
    } catch (err) {
      console.error('[Database] Error closing database pool:', err.message);
    }

    console.log('[Server] Graceful shutdown complete. Exiting.');
    process.exit(0);
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    console.error('[Server] Forced shutdown timeout exceeded. Exiting immediately.');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGTERM', () => handleGracefulShutdown('SIGTERM'));
process.on('SIGINT', () => handleGracefulShutdown('SIGINT'));

export default server;
