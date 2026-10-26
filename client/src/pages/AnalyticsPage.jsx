import React, { useState, useEffect } from 'react';
import { getDashboardAnalytics } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      <div className="panel" style={{ padding: '32px', borderLeft: '4px solid var(--status-danger)' }}>
        <h3 style={{ color: 'var(--status-danger)', marginBottom: '8px' }}>Analytics Data Unavailable</h3>
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
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
            Security Posture Analytics
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Live relational telemetry, exposure rates, containment velocity, and MTTD/MTTR indicators.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportJson}
            title="Export JSON telemetry payload"
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Export Telemetry (JSON)
          </button>
        </div>
      </div>

      {/* Top KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
        <div className="panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Total Scans Run
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
            {scans.total}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--status-healthy)', marginTop: '4px' }}>
            {scans.completed} completed ({scans.failed} failed)
          </div>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Total Exposures
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: totalFindings > 0 ? 'var(--status-danger)' : 'var(--text-primary)', marginTop: '6px' }}>
            {totalFindings}
          </div>
          <div style={{ fontSize: '12px', color: (findings.critical || 0) + (findings.high || 0) > 0 ? 'var(--status-danger)' : 'var(--text-muted)', marginTop: '4px' }}>
            {(findings.critical || 0) + (findings.high || 0)} Critical & High
          </div>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Active Incidents
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: ((incidents.open || 0) + (incidents.in_progress || 0)) > 0 ? 'var(--status-warning)' : 'var(--text-primary)', marginTop: '6px' }}>
            {incidents.open + incidents.in_progress + incidents.pending_verification}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {incidents.unassigned} unassigned tickets
          </div>
        </div>

        <div className="panel" style={{ padding: '20px' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            Mean Time to Remediate (MTTR)
          </span>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--status-healthy)', marginTop: '6px' }}>
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '12px' }}>
            {['critical', 'high', 'medium', 'low'].map(sev => {
              const count = findings[sev] || 0;
              const pct = totalFindings > 0 ? Math.round((count / totalFindings) * 100) : 0;
              const color =
                sev === 'critical' ? 'var(--status-danger)' :
                sev === 'high' ? 'var(--status-warning)' :
                sev === 'medium' ? 'var(--accent-cyan)' : 'var(--text-muted)';
              return (
                <div key={sev}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {sev}
                    </span>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{count} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
            {Object.keys(categories).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No category exposures recorded yet.</p>
            ) : (
              Object.entries(categories).map(([cat, count]) => (
                <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)', fontWeight: 600 }}>{cat}</span>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>{count} matches</span>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px', marginTop: '14px' }}>
          <div style={{ padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>OPEN</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '4px' }}>{incidents.open}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>IN PROGRESS</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent-cyan)', marginTop: '4px' }}>{incidents.in_progress}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>PENDING VERIFICATION</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-warning)', marginTop: '4px' }}>{incidents.pending_verification}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>RESOLVED</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--status-healthy)', marginTop: '4px' }}>{incidents.resolved}</div>
          </div>
          <div style={{ padding: '16px', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderRadius: 'var(--radius-md)', textAlign: 'center', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>CLOSED</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-muted)', marginTop: '4px' }}>{incidents.closed}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsPage;
