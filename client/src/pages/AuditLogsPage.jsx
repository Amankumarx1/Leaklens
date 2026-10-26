import React from 'react';
import StatusBadge from '../components/StatusBadge';

export function AuditLogsPage() {
  return (
    <div className="dev-placeholder">
      <div className="dev-badge-row">
        <StatusBadge type="info">Phase 2 Scheduled</StatusBadge>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target: Forensic Audit Trail & Non-repudiation</span>
      </div>

      <h3>Defensive Audit Trail</h3>
      <p>
        Forensic audit review and security event investigation are scheduled for Phase 2.
        The underlying <code>leaklens.audit_logs</code> schema provides structured JSON metadata validation, 
        user attribution, and append-only constraints for regulatory compliance.
      </p>

      <div className="dev-feature-list">
        <h4>Planned Audit Log Features (Phase 2)</h4>
        <ul>
          <li>Append-only chronological event streaming</li>
          <li>Structured JSON metadata inspection for all administrative actions</li>
          <li>Forensic search by user ID, event type, and date range</li>
          <li>Exportable audit bundles for SIEM ingestion and SOC review</li>
        </ul>
      </div>
    </div>
  );
}

export default AuditLogsPage;
