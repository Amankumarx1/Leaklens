import React, { useState, useEffect } from 'react';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { getIncidents, getIncidentMetrics } from '../services/api';

export function IncidentsPage({ user, onNavigate }) {
  const [incidents, setIncidents] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const isCompliance = user?.role === 'COMPLIANCE_REVIEWER';

  const loadData = useCallback(async () => {
    try {
      setError(null);

      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (priorityFilter) params.priority = priorityFilter;

      const [incRes, metRes] = await Promise.all([
        getIncidents(params),
        getIncidentMetrics()
      ]);

      if (incRes?.success && incRes?.data) {
        setIncidents(incRes.data.incidents || []);
      }
      if (metRes?.success && metRes?.data) {
        setMetrics(metRes.data.metrics || null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load security incidents.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        setError(null);
        const params = {};
        if (statusFilter) params.status = statusFilter;
        if (priorityFilter) params.priority = priorityFilter;

        const [incRes, metRes] = await Promise.all([
          getIncidents(params),
          getIncidentMetrics()
        ]);

        if (!ignore && incRes?.success && incRes?.data) {
          setIncidents(incRes.data.incidents || []);
        }
        if (!ignore && metRes?.success && metRes?.data) {
          setMetrics(metRes.data.metrics || null);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load security incidents.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => { ignore = true; };
  }, [statusFilter, priorityFilter]);

  const filteredIncidents = incidents.filter(inc => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inc.title?.toLowerCase().includes(q) ||
      inc.incident_id?.toLowerCase().includes(q) ||
      inc.assigned_user_name?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="page-container">
      {/* Header and Action */}
      <div className="section-header" style={{ marginBottom: '16px' }}>
        <div>
          <h2>Security Incident Management</h2>
          <p>Triage active exposures, assign containment tasks, track remediation, and execute atomic resolutions.</p>
        </div>
        {!isCompliance && (
          <button
            id="btn-create-incident"
            className="btn btn-primary"
            onClick={() => onNavigate('incidents-new')}
          >
            + New Incident
          </button>
        )}
      </div>

      {/* Incident Posture Metrics */}
      {metrics && (
        <div className="metrics-grid" style={{ marginBottom: '20px' }}>
          <div className="metric-card">
            <span className="metric-label">Total Incidents</span>
            <span className="metric-value">{metrics.totalIncidents}</span>
            <span className="metric-meta">Persisted response cases</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Open & Triaging</span>
            <span className="metric-value" style={{ color: 'var(--status-warning)' }}>
              {metrics.openIncidents}
            </span>
            <span className="metric-meta">{metrics.unassignedCount} unassigned</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">In Progress</span>
            <span className="metric-value" style={{ color: 'var(--accent-cyan)' }}>
              {metrics.inProgressIncidents}
            </span>
            <span className="metric-meta">Active remediation</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Pending Verification</span>
            <span className="metric-value" style={{ color: '#a855f7' }}>
              {metrics.pendingVerificationIncidents}
            </span>
            <span className="metric-meta">Awaiting validation check</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Resolved</span>
            <span className="metric-value" style={{ color: 'var(--status-success)' }}>
              {metrics.resolvedIncidents}
            </span>
            <span className="metric-meta">{metrics.closedIncidents} officially closed</span>
          </div>
          <div className="metric-card">
            <span className="metric-label">Critical / High</span>
            <span className="metric-value" style={{ color: 'var(--status-danger)' }}>
              {metrics.criticalPriority + metrics.highPriority}
            </span>
            <span className="metric-meta">High-impact exposures</span>
          </div>
        </div>
      )}

      {/* Filters Bar */}
      <div className="filter-bar" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search by title, ID, or assignee..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ maxWidth: '300px' }}
        />

        <select
          id="incident-filter-status"
          className="form-input"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ maxWidth: '200px' }}
        >
          <option value="">All Statuses</option>
          <option value="OPEN">OPEN</option>
          <option value="IN_PROGRESS">IN_PROGRESS</option>
          <option value="PENDING_VERIFICATION">PENDING_VERIFICATION</option>
          <option value="RESOLVED">RESOLVED</option>
          <option value="CLOSED">CLOSED</option>
        </select>

        <select
          id="incident-filter-priority"
          className="form-input"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{ maxWidth: '200px' }}
        >
          <option value="">All Priorities</option>
          <option value="CRITICAL">CRITICAL</option>
          <option value="HIGH">HIGH</option>
          <option value="MEDIUM">MEDIUM</option>
          <option value="LOW">LOW</option>
        </select>

        <button className="btn btn-secondary" onClick={loadData}>
          Refresh
        </button>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="state-center" style={{ minHeight: '260px' }}>
          <div className="spinner" />
          <p style={{ color: 'var(--text-secondary)' }}>Loading security incidents from database...</p>
        </div>
      ) : error ? (
        <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
          <strong>Error loading incidents:</strong> {error}
          <div style={{ marginTop: '8px' }}>
            <button className="btn btn-secondary" onClick={loadData}>Retry</button>
          </div>
        </div>
      ) : filteredIncidents.length === 0 ? (
        <EmptyState
          title="No Security Incidents Found"
          message={statusFilter || priorityFilter || searchQuery
            ? "No incidents match the active filters. Adjust your criteria or clear filters."
            : "No security exposure incidents have been escalated yet. You can create an incident from detected findings."}
          actionLabel={!isCompliance && !statusFilter && !priorityFilter ? "Create First Incident" : undefined}
          onAction={!isCompliance && !statusFilter && !priorityFilter ? () => onNavigate('incidents-new') : undefined}
        />
      ) : (
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Incident ID</th>
                <th>Title</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Assigned Analyst</th>
                <th>Findings</th>
                <th>Created</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredIncidents.map(inc => {
                const priorityType = inc.priority?.toLowerCase() === 'critical' ? 'danger'
                  : inc.priority?.toLowerCase() === 'high' ? 'danger'
                  : inc.priority?.toLowerCase() === 'medium' ? 'warning'
                  : 'neutral';

                const statusType = inc.status === 'RESOLVED' ? 'success'
                  : inc.status === 'CLOSED' ? 'neutral'
                  : inc.status === 'PENDING_VERIFICATION' ? 'info'
                  : inc.status === 'IN_PROGRESS' ? 'info'
                  : 'warning';

                return (
                  <tr key={inc.incident_id} id={`incident-row-${inc.incident_id}`}>
                    <td style={{ fontFamily: 'monospace', fontSize: '12px' }} title={inc.incident_id}>
                      {inc.incident_id.slice(0, 8)}...
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-primary)' }}>{inc.title}</strong>
                    </td>
                    <td>
                      <StatusBadge type={priorityType}>{inc.priority}</StatusBadge>
                    </td>
                    <td>
                      <StatusBadge type={statusType}>{inc.status}</StatusBadge>
                    </td>
                    <td>
                      {inc.assigned_user_name ? (
                        <span style={{ color: 'var(--text-secondary)' }}>{inc.assigned_user_name}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ backgroundColor: 'rgba(6, 182, 212, 0.1)', color: 'var(--accent-cyan)', padding: '2px 8px', borderRadius: '12px', fontSize: '11px' }}>
                        {inc.total_findings || 0} findings
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {new Date(inc.created_at).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        id={`btn-manage-incident-${inc.incident_id}`}
                        className="btn btn-secondary"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                        onClick={() => onNavigate('incident-detail', inc.incident_id)}
                      >
                        Inspect & Respond
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default IncidentsPage;
