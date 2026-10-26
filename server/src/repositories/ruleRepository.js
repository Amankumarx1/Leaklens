import { executeQuery, checkDatabaseHealth } from '../database/connection.js';
import { CANONICAL_RULES } from '../services/scanner/rules/ruleDefinitions.js';
import memoryStore from './memoryStore.js';

export async function getEnabledRules() {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT rule_id, rule_name, category, description, severity, is_enabled 
       FROM leaklens.detection_rules 
       WHERE is_enabled = 1`
    );
    if (result.recordset && result.recordset.length > 0) {
      // Re-hydrate compiled regex pattern from definitions
      return result.recordset.map(row => {
        const canonical = CANONICAL_RULES.find(c => c.rule_name === row.rule_name);
        return {
          ...row,
          pattern: canonical ? canonical.pattern : new RegExp(row.rule_name, 'g')
        };
      });
    }
  }

  // Memory fallback
  return memoryStore.detection_rules.filter(r => r.is_enabled);
}

export async function getAllRules() {
  const dbHealth = await checkDatabaseHealth();
  if (dbHealth.isHealthy) {
    const result = await executeQuery(
      `SELECT rule_id, rule_name, category, description, severity, is_enabled 
       FROM leaklens.detection_rules`
    );
    return result.recordset || [];
  }

  return memoryStore.detection_rules.map(({ pattern, ...rest }) => rest);
}

export default {
  getEnabledRules,
  getAllRules
};
