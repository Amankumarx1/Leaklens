import React, { useState, useEffect, useCallback } from 'react';
import { getDashboardAnalytics, getIncidentMetrics } from '../services/api';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import StatusBadge from '../components/StatusBadge';

export function DashboardPage({ health, user, onNavigate }) {
  const [metrics, setMetrics] = useState(null);
  const [incidentMetrics, setIncidentMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setError(null);
      const [dashRes, incRes] = await Promise.all([
        getDashboardAnalytics(),
        getIncidentMetrics().catch(() => null)
      ]);

      if (dashRes?.success) {
        setMetrics(dashRes.data);
      }
      if (incRes?.success && incRes?.data?.metrics) {
        setIncidentMetrics(incRes.data.metrics);
      }
    } catch (err) {
      setError(err.message || 'Failed to load telemetry.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        setError(null);
        const [dashRes, incRes] = await Promise.all([
          getDashboardAnalytics(),
          getIncidentMetrics().catch(() => null)
        ]);

        if (!ignore && dashRes?.success) {
          setMetrics(dashRes.data);
        }
        if (!ignore && incRes?.success && incRes?.data?.metrics) {
          setIncidentMetrics(incRes.data.metrics);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load telemetry.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => { ignore = true; };
  }, []);

  if (loading && !metrics) {
    return <LoadingState message="Loading security posture metrics..." />;
  }

  if (error && !metrics) {
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
          <div className="metric-card-title">Active Incidents</div>
          <div className="metric-card-value" style={{ color: (incidentMetrics?.openIncidents + incidentMetrics?.inProgressIncidents) > 0 ? 'var(--status-warning)' : 'var(--accent-cyan)' }}>
            {(incidentMetrics?.openIncidents || 0) + (incidentMetrics?.inProgressIncidents || 0)}
          </div>
          <div className="metric-card-meta">
            {incidentMetrics ? `Pending Verif: ${incidentMetrics.pendingVerificationIncidents || 0} | Resolved: ${incidentMetrics.resolvedIncidents || 0}` : 'Incident triage active'}
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-card-title">Critical & High Severity</div>
          <div className="metric-card-value" style={{ color: (criticalCount + highCount) > 0 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
            {criticalCount + highCount}
          </div>
          <div className="metric-card-meta">Critical: {criticalCount} | High: {highCount}</div>
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
              <button className="btn btn-secondary" onClick={() => onNavigate('incidents')}>
                View Incidents ({incidentMetrics?.totalIncidents || 0})
              </button>
              <button className="btn btn-secondary" onClick={() => onNavigate('findings')}>
                Inspect Findings ({totalFindings})
              </button>
              {canScan && (
                <button className="btn btn-primary" onClick={() => onNavigate('scans-new')}>
                  + Scan File
                </button>
              )}
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
              <strong style={{ fontSize: '13px' }}>Atomic Incident Resolution</strong>
              <StatusBadge type="healthy">sp_resolve_incident</StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Transactional state progression, finding remediation updates, and immutable audit logs executed atomically.
            </p>
          </div>

          <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <strong style={{ fontSize: '13px' }}>Optimistic Concurrency (v2)</strong>
              <StatusBadge type="healthy">Active</StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Version token validation prevents conflicting simultaneous status changes across SOC analyst teams.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
