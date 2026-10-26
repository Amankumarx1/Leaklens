import { executeQuery, checkDatabaseHealth } from '../database/connection.js';
import memoryStore from './memoryStore.js';

export async function findByEmail(email) {
  if (!email || typeof email !== 'string') return null;
  const normalizedEmail = email.trim().toLowerCase();

  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT user_id, display_name, email, password_hash, role, is_active 
       FROM leaklens.users 
       WHERE LOWER(email) = LOWER(@email)`,
      { email: normalizedEmail }
    );
    return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
  }

  // Offline / memory fallback
  const user = memoryStore.users.find(u => u.email.toLowerCase() === normalizedEmail);
  return user ? { ...user } : null;
}

export async function findById(userId) {
  if (!userId) return null;

  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT user_id, display_name, email, role, is_active 
       FROM leaklens.users 
       WHERE user_id = @userId`,
      { userId }
    );
    return result.recordset && result.recordset.length > 0 ? result.recordset[0] : null;
  }

  const user = memoryStore.users.find(u => u.user_id === userId);
  if (!user) return null;
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

export default {
  findByEmail,
  findById
};
