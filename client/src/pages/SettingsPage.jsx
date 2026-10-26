import React from 'react';
import StatusBadge from '../components/StatusBadge';

export function SettingsPage({ health }) {
  const isDbConnected = health?.components?.database?.status === 'connected';

  const detectionRules = [
    { name: 'AWS Access Key ID', category: 'API_KEY', pattern: 'AKIA[0-9A-Z]{16}', severity: 'critical', status: 'Enabled' },
    { name: 'GitHub Personal Access Token', category: 'TOKEN', pattern: 'ghp_[A-Za-z0-9_]{36,255}', severity: 'critical', status: 'Enabled' },
    { name: 'Generic API Key / Secret', category: 'SECRET_KEY', pattern: '(?:api_key|secret)\\s*=\\s*["\'][A-Za-z0-9_-]{16,}["\']', severity: 'high', status: 'Enabled' },
    { name: 'Database Connection String', category: 'DATABASE_CREDENTIAL', pattern: 'Server=tcp:[^;]+;Database=[^;]+;User ID=[^;]+;Password=[^;]+;', severity: 'critical', status: 'Enabled' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Platform Settings & Security Posture
        </h2>
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          Environment configuration, cloud dependency readiness, and detection engine signatures.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Runtime Diagnostics */}
        <div className="panel">
          <div className="panel-header">
            <h3>Runtime Environment</h3>
            <StatusBadge type="healthy">{health?.environment || 'production'}</StatusBadge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>API Gateway:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{import.meta.env.VITE_API_URL || '/api'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Liveness Status:</span>
              <span style={{ color: 'var(--status-healthy)', fontWeight: 600 }}>
                {health?.components?.api?.status === 'up' ? 'Online (HTTP 200)' : 'Pending'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Relational Database:</span>
              <span style={{ color: isDbConnected ? 'var(--status-healthy)' : 'var(--status-warning)', fontWeight: 600 }}>
                {isDbConnected ? 'Connected (Azure SQL / MSSQL)' : 'Degraded / Local Fallback'}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>System Uptime:</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {health?.uptimeSeconds !== undefined ? `${health.uptimeSeconds} seconds` : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Cloud Security Architecture */}
        <div className="panel">
          <div className="panel-header">
            <h3>Cloud Security Controls</h3>
            <StatusBadge type="info">Azure Native</StatusBadge>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', marginTop: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Transport Encryption:</span>
              <span style={{ color: 'var(--status-healthy)' }}>HTTPS (TLS 1.2+ Enforced)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Object Storage Isolation:</span>
              <span style={{ color: 'var(--status-healthy)' }}>Private Container (leaklens-scans)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Service Identity:</span>
              <span style={{ color: 'var(--status-healthy)' }}>Microsoft Entra Managed Identity</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Runtime Secrets:</span>
              <span style={{ color: 'var(--status-healthy)' }}>Azure Key Vault (RBAC Authorized)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)' }}>HTTP Perimeter Headers:</span>
              <span style={{ color: 'var(--status-healthy)' }}>CSP, HSTS, X-Frame-Options: DENY</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detection Engine Configuration */}
      <div className="panel">
        <div className="panel-header">
          <h3>Active Detection Signatures</h3>
          <StatusBadge type="healthy">4 Signatures Live</StatusBadge>
        </div>

        <div style={{ padding: 0, overflowX: 'auto', marginTop: '12px' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Signature Name</th>
                <th>Category</th>
                <th>Severity</th>
                <th>Regex Pattern Specification</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {detectionRules.map(rule => (
                <tr key={rule.name}>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{rule.name}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{rule.category}</td>
                  <td>
                    <StatusBadge type={rule.severity === 'critical' ? 'critical' : 'warning'}>
                      {rule.severity}
                    </StatusBadge>
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <code>{rule.pattern}</code>
                  </td>
                  <td>
                    <StatusBadge type="healthy">{rule.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
