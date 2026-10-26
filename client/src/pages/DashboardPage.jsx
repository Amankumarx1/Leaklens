import React, { useState, useEffect, useCallback } from 'react';
import { getDashboardAnalytics, getIncidentMetrics, getScans, getIncidents } from '../services/api';
import EmptyState from '../components/EmptyState';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import StatusBadge from '../components/StatusBadge';

export function DashboardPage({ health, user, onNavigate }) {
  const [metrics, setMetrics] = useState(null);
  const [incidentMetrics, setIncidentMetrics] = useState(null);
  const [recentScans, setRecentScans] = useState([]);
  const [recentIncidents, setRecentIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [dashRes, incRes, scansRes, incidentsRes] = await Promise.all([
        getDashboardAnalytics(),
        getIncidentMetrics().catch(() => null),
        getScans({ limit: 5 }).catch(() => null),
        getIncidents({ limit: 5 }).catch(() => null)
      ]);

      if (dashRes?.success) {
        setMetrics(dashRes.data);
      }
      if (incRes?.success && incRes?.data?.metrics) {
        setIncidentMetrics(incRes.data.metrics);
      }
      if (scansRes?.success && scansRes?.data) {
        setRecentScans(scansRes.data.slice(0, 5));
      }
      if (incidentsRes?.success && incidentsRes?.data?.incidents) {
        setRecentIncidents(incidentsRes.data.incidents.slice(0, 5));
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
        const [dashRes, incRes, scansRes, incidentsRes] = await Promise.all([
          getDashboardAnalytics(),
          getIncidentMetrics().catch(() => null),
          getScans({ limit: 5 }).catch(() => null),
          getIncidents({ limit: 5 }).catch(() => null)
        ]);

        if (!ignore) {
          if (dashRes?.success) setMetrics(dashRes.data);
          if (incRes?.success && incRes?.data?.metrics) setIncidentMetrics(incRes.data.metrics);
          if (scansRes?.success && scansRes?.data) setRecentScans(scansRes.data.slice(0, 5));
          if (incidentsRes?.success && incidentsRes?.data?.incidents) setRecentIncidents(incidentsRes.data.incidents.slice(0, 5));
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
    return <LoadingState message="Loading security posture metrics & telemetry..." />;
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
            Operational Security Posture
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Real-time credential exposure detection, response telemetry, and system controls.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            id="btn-refresh-dashboard" 
            className="btn btn-secondary" 
            onClick={fetchMetrics} 
            disabled={loading}
            title="Reload metrics from database"
          >
            {loading ? 'Refreshing...' : 'Refresh Telemetry'}
          </button>
          
          <button 
            id="btn-nav-analytics" 
            className="btn btn-secondary" 
            onClick={() => onNavigate('analytics')}
            title="Open Power BI DirectQuery metrics"
          >
            📊 Analytics & BI
          </button>

          {canScan && (
            <button 
              id="btn-dashboard-new-scan" 
              className="btn btn-primary" 
              onClick={() => onNavigate('scans-new')}
            >
              + Scan File
            </button>
          )}
        </div>
      </div>

      {/* Interactive Metric Cards Row */}
      <div className="metrics-grid">
        <div 
          className="metric-card hover-card" 
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('scans')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('scans'); }}
          style={{ cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
          title="Click to view all scans"
          id="card-metric-scans"
        >
          <div className="metric-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Completed Scans</span>
            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>View →</span>
          </div>
          <div className="metric-card-value">{totalScans}</div>
          <div className="metric-card-meta">{totalScans === 0 ? 'Awaiting first scan job' : 'Processed file batches'}</div>
        </div>

        <div 
          className="metric-card hover-card" 
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('findings')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('findings'); }}
          style={{ cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
          title="Click to inspect all exposure findings"
          id="card-metric-findings"
        >
          <div className="metric-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Exposures Detected</span>
            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>View →</span>
          </div>
          <div className="metric-card-value" style={{ color: totalFindings > 0 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
            {totalFindings}
          </div>
          <div className="metric-card-meta">{totalFindings === 0 ? 'No findings recorded' : 'Redacted findings stored'}</div>
        </div>

        <div 
          className="metric-card hover-card" 
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('incidents')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('incidents'); }}
          style={{ cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
          title="Click to manage security incidents"
          id="card-metric-incidents"
        >
          <div className="metric-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Active Incidents</span>
            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>View →</span>
          </div>
          <div className="metric-card-value" style={{ color: ((incidentMetrics?.openIncidents || 0) + (incidentMetrics?.inProgressIncidents || 0)) > 0 ? 'var(--status-warning)' : 'var(--accent-cyan)' }}>
            {(incidentMetrics?.openIncidents || 0) + (incidentMetrics?.inProgressIncidents || 0)}
          </div>
          <div className="metric-card-meta">
            {incidentMetrics ? `Pending: ${incidentMetrics.pendingVerificationIncidents || 0} | Resolved: ${incidentMetrics.resolvedIncidents || 0}` : 'Incident triage active'}
          </div>
        </div>

        <div 
          className="metric-card hover-card" 
          role="button"
          tabIndex={0}
          onClick={() => onNavigate('findings')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onNavigate('findings'); }}
          style={{ cursor: 'pointer', transition: 'border-color 0.2s, transform 0.15s' }}
          title="Click to view high-severity exposures"
          id="card-metric-critical"
        >
          <div className="metric-card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Critical & High Severity</span>
            <span style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>View →</span>
          </div>
          <div className="metric-card-value" style={{ color: (criticalCount + highCount) > 0 ? 'var(--status-danger)' : 'var(--text-primary)' }}>
            {criticalCount + highCount}
          </div>
          <div className="metric-card-meta">Critical: {criticalCount} | High: {highCount}</div>
        </div>
      </div>

      {/* Main Content Panels */}
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
        <>
          {/* Breakdown Panels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            {/* Severity Breakdown */}
            <div className="panel">
              <div className="panel-header">
                <h3>Severity Distribution</h3>
                <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => onNavigate('findings')}>
                  View All
                </button>
              </div>
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
            <div className="panel">
              <div className="panel-header">
                <h3>Detected Categories</h3>
                <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => onNavigate('findings')}>
                  Filter
                </button>
              </div>
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

          {/* Recent Scans & Recent Incidents Double Column */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Recent Scans */}
            <div className="panel">
              <div className="panel-header">
                <h3>Recent Scan Executions</h3>
                <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => onNavigate('scans')}>
                  View Scans ({totalScans})
                </button>
              </div>
              {recentScans.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No recent scans.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentScans.map(scan => (
                    <div 
                      key={scan.scan_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500' }}>{scan.original_filename || 'diagnostic.txt'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(scan.created_at).toLocaleString()} • {scan.total_findings || 0} findings
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => onNavigate('scan-detail', scan.scan_id)}
                      >
                        Inspect →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Incidents */}
            <div className="panel">
              <div className="panel-header">
                <h3>Active Incident Response Desk</h3>
                <button className="btn btn-secondary" style={{ fontSize: '11px', padding: '4px 8px' }} onClick={() => onNavigate('incidents')}>
                  View Incidents ({incidentMetrics?.totalIncidents || 0})
                </button>
              </div>
              {recentIncidents.length === 0 ? (
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No active incidents created yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {recentIncidents.map(inc => (
                    <div 
                      key={inc.incident_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        backgroundColor: 'var(--bg-app)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '13px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: '500' }}>{inc.title}</div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '2px' }}>
                          <StatusBadge type={inc.status === 'RESOLVED' ? 'healthy' : 'warning'}>
                            {inc.status}
                          </StatusBadge>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{inc.priority}</span>
                        </div>
                      </div>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '11px', padding: '4px 8px' }}
                        onClick={() => onNavigate('incident-detail', inc.incident_id)}
                      >
                        Workspace →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
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
