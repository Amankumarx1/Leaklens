import React from 'react';
import StatusBadge from '../components/StatusBadge';

export function IncidentsPage() {
  return (
    <div className="dev-placeholder">
      <div className="dev-badge-row">
        <StatusBadge type="info">Phase 2/3 Scheduled</StatusBadge>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target: Incident Management & Remediation</span>
      </div>

      <h3>Security Incident Response</h3>
      <p>
        The incident response lifecycle, containment tracking, and analyst assignment interface
        are scheduled for upcoming phases. The backend and database foundation already implement 
        the atomic stored procedure <code>leaklens.sp_resolve_incident</code> and junction table 
        <code>leaklens.incident_findings</code>.
      </p>

      <div className="dev-feature-list">
        <h4>Planned Incident Features (Phase 2/3)</h4>
        <ul>
          <li>Incident ticketing with priority triage (Critical, High, Medium, Low)</li>
          <li>Security analyst assignment and workflow tracking</li>
          <li>Atomic resolution via <code>sp_resolve_incident</code></li>
          <li>Remediation action recording (key rotation, secret revocation, file quarantine)</li>
          <li>Automated immutable audit logging for all status transitions</li>
        </ul>
      </div>
    </div>
  );
}

export default IncidentsPage;
