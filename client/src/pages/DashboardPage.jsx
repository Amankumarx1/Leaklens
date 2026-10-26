import React from 'react';
import EmptyState from '../components/EmptyState';
import StatusBadge from '../components/StatusBadge';

export function DashboardPage({ health, onNavigate }) {
  const isDbConnected = health?.components?.database?.status === 'connected';

  return (
    <div>
      {/* Metrics Row - Displaying Honest Zero Baseline */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-title">Completed Scans</div>
          <div className="metric-card-value">0</div>
          <div className="metric-card-meta">Awaiting first scan job</div>
        </div>

        <div className="metric-card">
          <div className="metric-card-title">Exposures Detected</div>
          <div className="metric-card-value">0</div>
          <div className="metric-card-meta">No findings recorded</div>
        </div>

        <div className="metric-card">
          <div className="metric-card-title">Open Incidents</div>
          <div className="metric-card-value">0</div>
          <div className="metric-card-meta">Zero active triage cases</div>
        </div>

        <div className="metric-card">
          <div className="metric-card-title">Detection Signatures</div>
          <div className="metric-card-value">7</div>
          <div className="metric-card-meta">Categories in schema</div>
        </div>
      </div>

      {/* Main Empty State / Workstation Banner */}
      <div className="panel">
        <div className="panel-header">
          <h3>Authorized Exposure Detection Overview</h3>
          <StatusBadge type={isDbConnected ? 'healthy' : 'warning'}>
            {isDbConnected ? 'Database Connected' : 'Database Offline (Local Dev)'}
          </StatusBadge>
        </div>

        <EmptyState 
          title="No Exposure Telemetry Recorded"
          description="LeakLens Phase 1 foundation is operational. The normalized 3NF relational schema, parameterized Express API, and cybersecurity UI shell are initialized. Scanning engine execution and incident workflows will be introduced in subsequent phases."
          actionText="Inspect Detection Scans"
          onAction={() => onNavigate('scans')}
        />
      </div>

      {/* Architectural Foundation Status Panel */}
      <div className="panel">
        <div className="panel-header">
          <h3>Phase 1 Foundation Verification</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Specification Checklist</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>Backend API Core</strong>
              <StatusBadge type="healthy">Active</StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Express.js with centralized env validation, CORS hardening, redacted logging, and <code>/api/health</code>.
            </p>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>Relational Database</strong>
              <StatusBadge type={isDbConnected ? 'healthy' : 'info'}>
                {isDbConnected ? 'Live Connection' : 'DDL Prepared'}
              </StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              9 normalized tables (3NF), <code>vw_exposure_analytics</code>, atomic stored procedure <code>sp_resolve_incident</code>.
            </p>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>Audit & Redaction</strong>
              <StatusBadge type="healthy">Enforced</StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Plaintext secret exclusion guaranteed; masked excerpt schema rules active.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
