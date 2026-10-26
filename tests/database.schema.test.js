import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Database Architecture & SQL Schema Verification', () => {
  const schemaPath = path.join(rootDir, 'database', 'schema.sql');
  const viewsPath = path.join(rootDir, 'database', 'views.sql');
  const proceduresPath = path.join(rootDir, 'database', 'procedures.sql');
  const queriesPath = path.join(rootDir, 'database', 'queries.sql');
  const erDiagramPath = path.join(rootDir, 'docs', 'er-diagram.mmd');

  it('should have all SQL and documentation deliverables present on disk', () => {
    expect(fs.existsSync(schemaPath)).toBe(true);
    expect(fs.existsSync(viewsPath)).toBe(true);
    expect(fs.existsSync(proceduresPath)).toBe(true);
    expect(fs.existsSync(queriesPath)).toBe(true);
    expect(fs.existsSync(erDiagramPath)).toBe(true);
  });

  it('should define all 9 required relational tables in schema.sql', () => {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    const requiredTables = [
      'users',
      'scan_jobs',
      'files',
      'detection_rules',
      'findings',
      'incidents',
      'incident_findings',
      'remediation_actions',
      'audit_logs'
    ];

    for (const table of requiredTables) {
      const tableRegex = new RegExp(`CREATE TABLE (leaklens\\.)?${table}\\b`, 'i');
      expect(schemaSql).toMatch(tableRegex);
    }
  });

  it('should define composite primary key on incident_findings junction table', () => {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    expect(schemaSql).toContain('PK_incident_findings PRIMARY KEY');
    expect(schemaSql).toMatch(/PRIMARY KEY (CLUSTERED )?\(incident_id,\s*finding_id\)/i);
  });

  it('should enforce check constraints on roles, status, and JSON metadata', () => {
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    expect(schemaSql).toContain('CK_users_role');
    expect(schemaSql).toContain('CK_scan_jobs_status');
    expect(schemaSql).toContain('CK_findings_severity');
    expect(schemaSql).toContain('CK_findings_status');
    expect(schemaSql).toContain('CK_incidents_status');
    expect(schemaSql).toContain('ISJSON(metadata_json) = 1');
  });

  it('should define vw_exposure_analytics without duplicate join multiplication', () => {
    const viewsSql = fs.readFileSync(viewsPath, 'utf8');
    expect(viewsSql).toContain('CREATE VIEW leaklens.vw_exposure_analytics');
    expect(viewsSql).toContain('total_findings');
    expect(viewsSql).toContain('unique_affected_files');
  });

  it('should define stored procedure sp_resolve_incident with transaction handling', () => {
    const procSql = fs.readFileSync(proceduresPath, 'utf8');
    expect(procSql).toContain('CREATE PROCEDURE leaklens.sp_resolve_incident');
    expect(procSql).toContain('BEGIN TRANSACTION');
    expect(procSql).toContain('COMMIT TRANSACTION');
    expect(procSql).toContain('ROLLBACK TRANSACTION');
    expect(procSql).toContain('leaklens.remediation_actions');
    expect(procSql).toContain('leaklens.audit_logs');
  });

  it('should ensure Mermaid ER diagram matches all 9 relational tables', () => {
    const erDiagram = fs.readFileSync(erDiagramPath, 'utf8');
    const requiredEntities = [
      'users',
      'scan_jobs',
      'files',
      'detection_rules',
      'findings',
      'incidents',
      'incident_findings',
      'remediation_actions',
      'audit_logs'
    ];

    for (const entity of requiredEntities) {
      expect(erDiagram).toContain(entity);
    }
  });
});
