import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import env from '../server/src/config/env.js';
import { executeQuery, checkDatabaseHealth, closePool } from '../server/src/database/connection.js';

export const SEED_USERS = [
  {
    user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
    display_name: 'Security Admin',
    email: 'admin@leaklens.local',
    password_plain: process.env.DEV_ADMIN_PASSWORD || 'LeakLensAdmin2026!',
    role: 'ADMIN'
  },
  {
    user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
    display_name: 'Lead Security Analyst',
    email: 'analyst@leaklens.local',
    password_plain: process.env.DEV_ANALYST_PASSWORD || 'LeakLensAnalyst2026!',
    role: 'ANALYST'
  },
  {
    user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003',
    display_name: 'Compliance Auditor',
    email: 'compliance@leaklens.local',
    password_plain: process.env.DEV_COMPLIANCE_PASSWORD || 'LeakLensCompliance2026!',
    role: 'COMPLIANCE_REVIEWER'
  }
];

export async function runDatabaseSeed() {
  if (env.IS_PRODUCTION) {
    throw new Error('SECURITY SAFEGUARD: Development seed script is strictly forbidden from running in production.');
  }

  const dbHealth = await checkDatabaseHealth();
  if (!dbHealth.isHealthy) {
    console.warn(`[Seed] SQL Server is not reachable (${dbHealth.message}). Skipping database execution.`);
    return false;
  }

  console.log('[Seed] Connected to MSSQL. Seeding development accounts and detection rules...');

  for (const user of SEED_USERS) {
    const passwordHash = await bcrypt.hash(user.password_plain, 10);

    const query = `
      IF NOT EXISTS (SELECT 1 FROM leaklens.users WHERE email = @email)
      BEGIN
        INSERT INTO leaklens.users (user_id, display_name, email, password_hash, role, is_active)
        VALUES (@user_id, @display_name, @email, @password_hash, @role, 1);
      END
    `;

    await executeQuery(query, {
      user_id: user.user_id,
      display_name: user.display_name,
      email: user.email,
      password_hash: passwordHash,
      role: user.role
    });

    console.log(`[Seed] Provisioned user: ${user.email} (${user.role})`);
  }

  console.log('[Seed] Database seed completed successfully.');
  return true;
}

// Direct execution handler
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  runDatabaseSeed()
    .then(() => closePool())
    .catch(err => {
      console.error('[Seed Error]:', err.message);
      process.exit(1);
    });
}

export default runDatabaseSeed;
