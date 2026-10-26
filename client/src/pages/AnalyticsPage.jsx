import React, { useState, useEffect } from 'react';
import { getDashboardAnalytics } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTab, setSelectedTab] = useState('overview'); // 'overview' | 'powerbi' | 'dax'

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        setLoading(true);
        const res = await getDashboardAnalytics();
        if (res?.data) {
          setData(res.data);
        }
      } catch (err) {
        setError(err.message || 'Failed to load security analytics');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  const handleExportJson = () => {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaklens-analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="panel" style={{ padding: '32px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading security intelligence and analytics metrics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel" style={{ padding: '32px', borderLeft: '4px solid var(--status-critical)' }}>
        <h3 style={{ color: 'var(--status-critical)', marginBottom: '8px' }}>Analytics Data Unavailable</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
      </div>
    );
  }

  const scans = data?.scans || { total: 0, completed: 0, failed: 0, in_progress: 0 };
  const findings = data?.findingsBySeverity || { critical: 0, high: 0, medium: 0, low: 0 };
  const categories = data?.findingsByCategory || {};
  const incidents = data?.incidents || { total: 0, open: 0, in_progress: 0, pending_verification: 0, resolved: 0, closed: 0, unassigned: 0 };
  const mttr = data?.mttr || { avgHours: 0, avgMinutes: 0, resolvedCases: 0 };
  const totalFindings = data?.totalFindings || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Security Posture Analytics & Power BI Integration
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            DP-900 relational reporting derived from <code>leaklens.vw_exposure_analytics</code> and <code>vw_incident_analytics</code>.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportJson}
            title="Export JSON telemetry payload"
          >
            Export Telemetry (JSON)
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          className={`btn ${selectedTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedTab('overview')}
        >
          Executive Overview
        </button>
        <button
          className={`btn ${selectedTab === 'powerbi' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedTab('powerbi')}
        >
          Power BI DirectQuery Config
        </button>
        <button
          className={`btn ${selectedTab === 'dax' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setSelectedTab('dax')}
        >
          DAX Measures Catalog
        </button>
      </div>

      {selectedTab === 'overview' && (
        <>
          {/* Top KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Scans Run
              </span>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '8px' }}>
                {scans.total}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--status-healthy)', marginTop: '4px' }}>
                {scans.completed} completed ({scans.failed} failed)
              </div>
            </div>

            <div className="panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Total Exposures
              </span>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '8px' }}>
                {totalFindings}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--status-critical)', marginTop: '4px' }}>
                {(findings.critical || 0) + (findings.high || 0)} Critical & High
              </div>
            </div>

            <div className="panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Active Incidents
              </span>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--status-warning)', marginTop: '8px' }}>
                {incidents.open + incidents.in_progress + incidents.pending_verification}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                {incidents.unassigned} unassigned tickets
              </div>
            </div>

            <div className="panel" style={{ padding: '20px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Mean Time to Remediate (MTTR)
              </span>
              <div style={{ fontSize: '28px', fontWeight: 700, color: 'var(--status-healthy)', marginTop: '8px' }}>
                {mttr.avgHours > 0 ? `${mttr.avgHours}h` : `${mttr.avgMinutes}m`}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Across {mttr.resolvedCases} resolved incidents
              </div>
            </div>
          </div>

          {/* Breakdown Grids */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Severity Distribution */}
            <div className="panel">
              <div className="panel-header">
                <h3>Findings by Severity Tier</h3>
                <StatusBadge type="info">{totalFindings} Total</StatusBadge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '8px' }}>
                {['critical', 'high', 'medium', 'low'].map(sev => {
                  const count = findings[sev] || 0;
                  const pct = totalFindings > 0 ? Math.round((count / totalFindings) * 100) : 0;
                  const color =
                    sev === 'critical' ? 'var(--status-critical)' :
                    sev === 'high' ? 'var(--status-warning)' :
                    sev === 'medium' ? 'var(--accent-secondary)' : 'var(--text-muted)';
                  return (
                    <div key={sev}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                        <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)', fontWeight: 500 }}>
                          {sev}
                        </span>
                        <span style={{ color: 'var(--text-secondary)' }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-app)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Secret Category Breakdown */}
            <div className="panel">
              <div className="panel-header">
                <h3>Exposures by Category</h3>
                <StatusBadge type="healthy">{Object.keys(categories).length} Categories</StatusBadge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                {Object.keys(categories).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No categories recorded.</p>
                ) : (
                  Object.entries(categories).map(([cat, count]) => (
                    <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
                      <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--accent-primary)' }}>{cat}</span>
                      <span style={{ fontSize: '13px', fontWeight: 600 }}>{count} matches</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Incident State Machine Funnel */}
          <div className="panel">
            <div className="panel-header">
              <h3>Incident Containment Pipeline</h3>
              <StatusBadge type="info">{incidents.total} Total Incidents</StatusBadge>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '12px' }}>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>OPEN</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>{incidents.open}</div>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>IN PROGRESS</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--accent-primary)', marginTop: '4px' }}>{incidents.in_progress}</div>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>PENDING VERIFICATION</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--status-warning)', marginTop: '4px' }}>{incidents.pending_verification}</div>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>RESOLVED</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--status-healthy)', marginTop: '4px' }}>{incidents.resolved}</div>
              </div>
              <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>CLOSED</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px' }}>{incidents.closed}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {selectedTab === 'powerbi' && (
        <div className="panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Power BI Desktop & DirectQuery Connection Guide</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6' }}>
            LeakLens exposes pre-aggregated reporting views to enable zero-latency DirectQuery reporting without
            overloading operational transaction tables or causing row duplication across many-to-many junction tables.
          </p>

          <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', borderLeft: '4px solid var(--accent-primary)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>1. Connection Parameters</h4>
              <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8', marginLeft: '16px' }}>
                <li><strong>Server:</strong> <code>&lt;prefix&gt;-sql-prod.database.windows.net</code></li>
                <li><strong>Database:</strong> <code>LeakLensDB</code></li>
                <li><strong>Data Connectivity Mode:</strong> DirectQuery</li>
                <li><strong>Authentication:</strong> Microsoft Entra ID or Dedicated Read-Only SQL Principal</li>
              </ul>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px', borderLeft: '4px solid var(--status-healthy)' }}>
              <h4 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '8px' }}>2. Available Relational Views</h4>
              <ul style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.8', marginLeft: '16px' }}>
                <li><code>leaklens.vw_exposure_analytics</code>: Secret categories, severity distributions, and incident escalation rates.</li>
                <li><code>leaklens.vw_incident_analytics</code>: Incident response tracking, MTTR resolution duration, and verification states.</li>
                <li><code>leaklens.vw_operational_metrics</code>: Scan pipeline success rates, volume scanned, and operational health.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'dax' && (
        <div className="panel" style={{ padding: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Calculated DAX Measures Reference</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
            Production DAX definitions used to build the LeakLens four-page Power BI report model:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--accent-primary)', marginBottom: '6px' }}>Mean Time to Remediate (MTTR in Hours)</h4>
              <pre style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', margin: 0 }}>
{`Mean Time to Remediate (Hours) = 
AVERAGEX(
    FILTER(
        'vw_incident_analytics',
        NOT(ISBLANK('vw_incident_analytics'[resolution_duration_hours]))
    ),
    'vw_incident_analytics'[resolution_duration_hours]
)`}
              </pre>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--accent-primary)', marginBottom: '6px' }}>Scan Pipeline Success Rate</h4>
              <pre style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', margin: 0 }}>
{`Scan Success Rate = 
DIVIDE(
    CALCULATE(SUM('vw_operational_metrics'[total_jobs]), 'vw_operational_metrics'[scan_status] = "completed"),
    SUM('vw_operational_metrics'[total_jobs]),
    0
)`}
              </pre>
            </div>

            <div style={{ padding: '16px', backgroundColor: 'var(--bg-app)', borderRadius: '6px' }}>
              <h4 style={{ fontSize: '13px', color: 'var(--accent-primary)', marginBottom: '6px' }}>Critical & High Severity Exposure Ratio</h4>
              <pre style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', margin: 0 }}>
{`High Risk Exposure Ratio = 
DIVIDE(
    CALCULATE(SUM('vw_exposure_analytics'[total_findings]), 'vw_exposure_analytics'[severity] IN {"critical", "high"}),
    SUM('vw_exposure_analytics'[total_findings]),
    0
)`}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnalyticsPage;
