import React from 'react';
import StatusBadge from '../components/StatusBadge';

export function SettingsPage({ health }) {
  const isDbConnected = health?.components?.database?.status === 'connected';

  return (
    <div className="dev-placeholder">
      <div className="dev-badge-row">
        <StatusBadge type="info">Phase 2 Scheduled</StatusBadge>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target: Policy, Signatures & RBAC</span>
      </div>

      <h3>Platform Settings & Configuration</h3>
      <p>
        Detection rule management, Azure Blob storage connectivity, and RBAC user provisioning
        are scheduled for Phase 2/3. Below is the operational state of the current environment.
      </p>

      <div className="panel" style={{ marginTop: '24px', backgroundColor: 'var(--bg-app)' }}>
        <div className="panel-header">
          <h3>Runtime Configuration</h3>
          <StatusBadge type="healthy">{health?.environment || 'development'}</StatusBadge>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>API Base URL:</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>API Operational Status:</span>
            <span style={{ color: 'var(--status-healthy)' }}>{health?.components?.api?.status === 'up' ? 'Online' : 'Pending'}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Database Verification:</span>
            <span style={{ color: isDbConnected ? 'var(--status-healthy)' : 'var(--status-warning)' }}>
              {isDbConnected ? 'Connected (Live)' : 'Disconnected (Local Offline Dev)'}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Uptime:</span>
            <span>{health?.uptimeSeconds !== undefined ? `${health.uptimeSeconds} seconds` : 'N/A'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
