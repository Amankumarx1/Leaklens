import bcrypt from 'bcryptjs';
import { CANONICAL_RULES } from '../services/scanner/rules/ruleDefinitions.js';

/**
 * In-Memory Database Store for Testing and Offline Local Development.
 * Holds state in memory when a live Microsoft SQL Server instance is unreachable,
 * ensuring zero disruption to unit tests, manual checks, and viva demonstrations.
 */

// Initial pre-computed hashes for default seed users (password: 'LeakLensDev2026!')
const DEFAULT_HASH = bcrypt.hashSync('LeakLensDev2026!', 10);

export const memoryStore = {
  users: [
    {
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0001',
      display_name: 'Security Admin',
      email: 'admin@leaklens.local',
      password_hash: DEFAULT_HASH,
      role: 'ADMIN',
      is_active: 1,
      created_at: new Date().toISOString()
    },
    {
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0002',
      display_name: 'Lead Security Analyst',
      email: 'analyst@leaklens.local',
      password_hash: DEFAULT_HASH,
      role: 'ANALYST',
      is_active: 1,
      created_at: new Date().toISOString()
    },
    {
      user_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaa0003',
      display_name: 'Compliance Auditor',
      email: 'compliance@leaklens.local',
      password_hash: DEFAULT_HASH,
      role: 'COMPLIANCE_REVIEWER',
      is_active: 1,
      created_at: new Date().toISOString()
    }
  ],
  detection_rules: CANONICAL_RULES.map(r => ({ ...r })),
  scan_jobs: [],
  files: [],
  findings: [],
  incidents: [],
  incident_findings: [],
  remediation_actions: [],
  audit_logs: [],
  integration_preferences: {
    power_bi_report_name: 'Executive Exposure Telemetry',
    power_bi_report_url: 'https://app.powerbi.com/groups/me/reports/leaklens-executive-summary',
    azure_subscription_name: 'LeakLens-Production-Subscription',
    azure_resource_group: 'rg-leaklens-eastus-001',
    azure_region: 'eastus'
  },
  integration_last_checks: {}
};

export function clearMemoryStore() {
  memoryStore.scan_jobs = [];
  memoryStore.files = [];
  memoryStore.findings = [];
  memoryStore.incidents = [];
  memoryStore.incident_findings = [];
  memoryStore.remediation_actions = [];
  memoryStore.audit_logs = [];
}

export default memoryStore;
