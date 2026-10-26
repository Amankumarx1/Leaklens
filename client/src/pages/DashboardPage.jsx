import React, { useState, useEffect } from 'react';
import { getDashboardAnalytics } from '../services/api';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import StatusBadge from '../components/StatusBadge';

export function DashboardPage({ health, user, onNavigate }) {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      try {
        setError(null);
        const res = await getDashboardAnalytics();
        if (isMounted && res?.success) {
          setMetrics(res.data);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadDashboard();
    return () => { isMounted = false; };
  }, []);

  if (loading && !metrics) {
    return <LoadingState message="Loading security posture metrics..." />;
  }

  if (error) {
    return <ErrorState title="Failed to Load Dashboard Telemetry" message={error} onRetry={fetchMetrics} />;
  }

  const isDbConnected = health?.components?.database?.status === 'connected';
  const totalScans = metrics?.totalCompletedScans || 0;
  const totalFindings = metrics?.totalFindings || 0;
  const criticalCount = metrics?.findingsBySeverity?.critical || 0;
  const highCount = metrics?.findingsBySeverity?.high || 0;
  const canScan = user?.role !== 'COMPLIANCE_REVIEWER';

  return (
    <div>
      {/* Metric Cards Row */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-card-title">Completed Scans</div>
          <div className="metric-card-value">{totalScans}</div>
          <div className="metric-card-meta">{totalScans === 0 ? 'Awaiting first scan job' : 'Processed file batches'}</div>
        </div>

        <div className="metric-card">
          <div className="metric-card-title">Exposures Detected</div>
          <div className="metric-card-value" style={{ color: totalFindings > 0 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
            {totalFindings}
          </div>
          <div className="metric-card-meta">{totalFindings === 0 ? 'No findings recorded' : 'Redacted findings stored'}</div>
        </div>

        <div className="metric-card">
          <div className="metric-card-title">Critical & High Severity</div>
          <div className="metric-card-value" style={{ color: (criticalCount + highCount) > 0 ? 'var(--status-warning)' : 'var(--text-primary)' }}>
            {criticalCount + highCount}
          </div>
          <div className="metric-card-meta">Critical: {criticalCount} | High: {highCount}</div>
        </div>

        <div className="metric-card">
          <div className="metric-card-title">Detection Signatures</div>
          <div className="metric-card-value">4</div>
          <div className="metric-card-meta">Active rules in engine</div>
        </div>
      </div>

      {/* Main Panel */}
      {totalScans === 0 ? (
        <div className="panel">
          <div className="panel-header">
            <h3>Authorized Exposure Detection Overview</h3>
            <StatusBadge type={isDbConnected ? 'healthy' : 'info'}>
              {isDbConnected ? 'MSSQL Live' : 'Local Standalone Store'}
            </StatusBadge>
          </div>

          <EmptyState
            title="No Exposure Telemetry Recorded"
            description="LeakLens scanning pipeline is operational. Upload an authorized plain text (.txt), JSON (.json), or CSV (.csv) file to execute real pattern detection, automated excerpt redaction, and database persistence."
            actionText={canScan ? "Initiate First File Scan" : null}
            onAction={canScan ? () => onNavigate('scans-new') : null}
          />
        </div>
      ) : (
        <div className="panel">
          <div className="panel-header">
            <h3>Exposure Severity & Category Breakdown</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {canScan && (
                <button className="btn btn-primary" onClick={() => onNavigate('scans-new')}>
                  + Scan Another File
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => onNavigate('findings')}>
                Inspect Findings ({totalFindings})
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Severity Breakdown */}
            <div style={{ background: 'var(--bg-app)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Severity Distribution
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(metrics?.findingsBySeverity || {}).map(([sev, count]) => (
                  <div key={sev} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <StatusBadge type={sev === 'critical' ? 'danger' : sev === 'high' ? 'warning' : 'info'}>
                      {sev.toUpperCase()}
                    </StatusBadge>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Category Breakdown */}
            <div style={{ background: 'var(--bg-app)', padding: '20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
                Detected Categories
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.entries(metrics?.findingsByCategory || {}).map(([cat, count]) => (
                  <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '600' }}>{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Security Architecture & Governance Panel */}
      <div className="panel">
        <div className="panel-header">
          <h3>Defensive Security & Privacy Verification</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Verified Controls</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>Safe In-Memory Masking</strong>
              <StatusBadge type="healthy">Active</StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Raw API keys, private key bodies, and tokens are redacted in memory before database insertion.
            </p>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>Backend RBAC Matrix</strong>
              <StatusBadge type="healthy">{user?.role || 'Active'}</StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Scan initiation strictly gated to ADMIN and ANALYST tiers. Compliance Reviewer restricted to read-only views.
            </p>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>3NF SQL Persistence</strong>
              <StatusBadge type="healthy">Normalized</StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Scans, files, and findings mapped via foreign key constraints with zero row duplication anomalies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
