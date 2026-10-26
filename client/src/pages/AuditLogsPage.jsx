import React, { useState, useEffect, useCallback } from 'react';
import { getAuditLogs } from '../services/api';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL'); // 'ALL' | 'TODAY' | 'WEEK'
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getAuditLogs({ limit: 200 });
      if (res?.data) {
        setLogs(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch forensic audit log trail');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await getAuditLogs({ limit: 200 });
        if (!ignore && res?.data) {
          setLogs(res.data);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to fetch forensic audit log trail');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, []);

  // Modal Escape key listener
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setSelectedLog(null);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [referenceDate] = useState(() => new Date());

  const filteredLogs = React.useMemo(() => {
    const todayStr = referenceDate.toDateString();
    const sevenDaysAgo = new Date(referenceDate.getTime() - 7 * 24 * 60 * 60 * 1000);

    return logs.filter(log => {
      if (filterType !== 'ALL' && log.event_type !== filterType) return false;

      // Date filtering
      if (dateFilter !== 'ALL' && log.created_at) {
        const logDate = new Date(log.created_at);
        if (dateFilter === 'TODAY' && logDate.toDateString() !== todayStr) return false;
        if (dateFilter === 'WEEK' && logDate < sevenDaysAgo) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const entityMatch = log.entity_id?.toLowerCase().includes(q);
        const userMatch = (log.user_name || log.user_email || '').toLowerCase().includes(q);
        const typeMatch = log.event_type?.toLowerCase().includes(q);
        return entityMatch || userMatch || typeMatch;
      }
      return true;
    });
  }, [logs, filterType, dateFilter, searchQuery, referenceDate]);

  const hasActiveFilters = Boolean(filterType !== 'ALL' || dateFilter !== 'ALL' || searchQuery);

  const handleClearFilters = () => {
    setFilterType('ALL');
    setDateFilter('ALL');
    setSearchQuery('');
  };

  const handleExportJson = () => {
    if (filteredLogs.length === 0) return;
    const sanitizedLogs = filteredLogs.map(l => ({
      audit_id: l.audit_id,
      event_type: l.event_type,
      user_name: l.user_name || 'System Operator',
      user_email: l.user_email || 'system@leaklens.local',
      entity_type: l.entity_type,
      entity_id: l.entity_id,
      created_at: l.created_at,
      metadata: l.metadata
    }));
    const blob = new Blob([JSON.stringify(sanitizedLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leaklens-audit-trail-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getEventBadgeType = (type) => {
    if (type?.includes('resolved') || type?.includes('completed')) return 'healthy';
    if (type?.includes('failed') || type?.includes('deleted')) return 'danger';
    if (type?.includes('assigned') || type?.includes('created')) return 'info';
    return 'warning';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Forensic Audit Trail & Accountability
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Append-only security log records from <code>leaklens.audit_logs</code> ensuring non-repudiation and traceability.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            id="btn-export-audit"
            className="btn btn-secondary" 
            onClick={handleExportJson}
            disabled={filteredLogs.length === 0}
            title="Export filtered records as JSON"
          >
            Export JSON
          </button>

          <button 
            id="btn-refresh-audit"
            className="btn btn-secondary" 
            onClick={fetchLogs} 
            disabled={loading}
            title="Refresh audit events"
          >
            {loading ? 'Refreshing...' : 'Refresh Logs'}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="panel" style={{
        padding: '12px 18px',
        display: 'flex',
        gap: '12px',
        flexWrap: 'wrap',
        alignItems: 'center',
        background: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'var(--glass-blur-light)',
        border: '1px solid rgba(255, 255, 255, 0.85)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-glass-sm)'
      }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            id="input-audit-search"
            type="text"
            className="input"
            placeholder="Search by Entity ID, user, or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '100%', padding: '8px 14px', borderRadius: 'var(--radius-pill)', fontSize: '13px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Event Filter:</span>
          <select
            id="select-audit-event"
            className="input"
            style={{ width: 'auto', padding: '8px 14px', borderRadius: 'var(--radius-pill)', fontSize: '13px' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">All Event Types</option>
            <option value="scan_created">Scan Created</option>
            <option value="scan_completed">Scan Completed</option>
            <option value="incident_created">Incident Created</option>
            <option value="incident_assigned">Incident Assigned</option>
            <option value="incident_action_added">Action Logged</option>
            <option value="incident_verified">Verification Recorded</option>
            <option value="incident_resolved">Incident Resolved (Atomic)</option>
            <option value="incident_reopened">Incident Reopened</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Time Range:</span>
          <select
            id="select-audit-timerange"
            className="input"
            style={{ width: 'auto', padding: '8px 14px', borderRadius: 'var(--radius-pill)', fontSize: '13px' }}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          >
            <option value="ALL">All Recorded Time</option>
            <option value="TODAY">Today Only</option>
            <option value="WEEK">Last 7 Days</option>
          </select>
        </div>

        {hasActiveFilters && (
          <button
            id="btn-audit-clear-filters"
            className="btn btn-secondary"
            style={{ fontSize: '12px', padding: '6px 14px' }}
            onClick={handleClearFilters}
          >
            Clear Filters
          </button>
        )}

        <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
          Showing {filteredLogs.length} of {logs.length} entries
        </div>
      </div>

      {/* Main Table / State */}
      {loading && logs.length === 0 ? (
        <div className="panel" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading forensic audit trail...</p>
        </div>
      ) : error && logs.length === 0 ? (
        <ErrorState title="Failed to Load Audit Log" message={error} onRetry={fetchLogs} />
      ) : filteredLogs.length === 0 ? (
        <EmptyState
          title={logs.length === 0 ? "No Audit Events Logged" : "No Matching Audit Events"}
          description={
            hasActiveFilters
              ? "No events match the active filters or search query."
              : "No administrative or triage events have been recorded in leaklens.audit_logs yet."
          }
          actionText={hasActiveFilters ? "Clear Filters" : null}
          onAction={hasActiveFilters ? handleClearFilters : null}
        />
      ) : (
        <div className="panel" style={{ padding: 0, overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0, width: '100%', fontSize: '13px', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 14px' }}>Timestamp (UTC)</th>
                <th style={{ padding: '12px 14px' }}>Event Action</th>
                <th style={{ padding: '12px 14px' }}>Target Resource</th>
                <th style={{ padding: '12px 14px' }}>Acting Operator</th>
                <th style={{ padding: '12px 14px' }}>Metadata / Details</th>
                <th style={{ padding: '12px 14px', textAlign: 'right' }}>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => {
                const uniqueKey = log.audit_id || `${log.created_at || 'audit'}-${idx}`;
                return (
                  <tr key={uniqueKey} style={{ borderBottom: '1px solid var(--border-subtle)' }} className="hover-row">
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusBadge type={getEventBadgeType(log.event_type)}>
                        {log.event_type}
                      </StatusBadge>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>{log.entity_type}</span>:{' '}
                      <span style={{ color: 'var(--accent-cyan)' }}>
                        {log.entity_id ? log.entity_id.slice(0, 8) + '...' : 'System'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{log.user_name || 'System Service'}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{log.user_email || 'internal@leaklens.local'}</div>
                    </td>
                    <td style={{ padding: '12px 14px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <code style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                        {log.metadata ? JSON.stringify(log.metadata) : 'None'}
                      </code>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                        onClick={() => setSelectedLog(log)}
                        title="Inspect full JSON metadata payload"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Forensic Metadata Inspector Modal */}
      {selectedLog && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedLog(null);
          }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
        >
          <div style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            width: '100%',
            maxWidth: '600px',
            padding: '24px',
            boxShadow: 'var(--shadow-card)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Forensic Event Payload</h3>
                <StatusBadge type={getEventBadgeType(selectedLog.event_type)}>
                  {selectedLog.event_type}
                </StatusBadge>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="btn btn-secondary"
                style={{ padding: '4px 8px', fontSize: '14px' }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>RECORD ID:</span>{' '}
                <code style={{ color: 'var(--accent-cyan)' }}>{selectedLog.audit_id || 'Auto-generated'}</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>TARGET RESOURCE:</span>{' '}
                <span>{selectedLog.entity_type} ({selectedLog.entity_id})</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>OPERATOR ATTRIBUTION:</span>{' '}
                <span>{selectedLog.user_name} ({selectedLog.user_email})</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>TIMESTAMP:</span>{' '}
                <span>{selectedLog.created_at ? new Date(selectedLog.created_at).toISOString() : 'N/A'}</span>
              </div>

              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>STRUCTURED METADATA PAYLOAD:</span>
                <pre style={{
                  backgroundColor: 'var(--bg-app)',
                  padding: '12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  marginTop: '6px'
                }}>
                  {JSON.stringify(selectedLog.metadata, null, 2)}
                </pre>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-primary" onClick={() => setSelectedLog(null)}>
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogsPage;
