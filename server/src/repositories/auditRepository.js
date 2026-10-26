import crypto from 'crypto';
import { executeQuery, checkDatabaseHealth } from '../database/connection.js';
import memoryStore from './memoryStore.js';

export async function createAuditEntry({
  user_id = null,
  event_type,
  entity_type,
  entity_id,
  metadata = null
}) {
  const audit_id = crypto.randomUUID();
  const now = new Date().toISOString();

  // Redact any accidentally passed sensitive keys in metadata
  let safeMetadata = null;
  if (metadata && typeof metadata === 'object') {
    const cleaned = { ...metadata };
    delete cleaned.password;
    delete cleaned.password_hash;
    delete cleaned.token;
    delete cleaned.secret;
    delete cleaned.raw_content;
    safeMetadata = JSON.stringify(cleaned);
  }

  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    await executeQuery(
      `INSERT INTO leaklens.audit_logs (audit_id, user_id, event_type, entity_type, entity_id, metadata_json, created_at)
       VALUES (@audit_id, @user_id, @event_type, @entity_type, @entity_id, @metadata_json, @created_at)`,
      {
        audit_id,
        user_id,
        event_type,
        entity_type,
        entity_id: String(entity_id || 'system'),
        metadata_json: safeMetadata,
        created_at: now
      }
    );
  } else {
    memoryStore.audit_logs.push({
      audit_id,
      user_id,
      event_type,
      entity_type,
      entity_id: String(entity_id || 'system'),
      metadata_json: safeMetadata,
      created_at: now
    });
  }

  return { audit_id, event_type, created_at: now };
}

export async function listAuditLogs({ limit = 50, offset = 0 } = {}) {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT 
         al.audit_id,
         al.event_type,
         al.entity_type,
         al.entity_id,
         al.metadata_json,
         al.created_at,
         u.display_name AS user_name,
         u.email AS user_email
       FROM leaklens.audit_logs al
       LEFT JOIN leaklens.users u ON al.user_id = u.user_id
       ORDER BY al.created_at DESC
       OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY`,
      { limit, offset }
    );
    return result.recordset || [];
  }

  return memoryStore.audit_logs
    .slice()
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(offset, offset + limit)
    .map(log => {
      const user = memoryStore.users.find(u => u.user_id === log.user_id);
      return {
        ...log,
        user_name: user?.display_name || 'System / Anonymous',
        user_email: user?.email || ''
      };
    });
}

export default {
  createAuditEntry,
  listAuditLogs
};
