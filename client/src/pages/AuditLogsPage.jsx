import React, { useState, useEffect } from 'react';
import { getAuditLogs } from '../services/api';
import StatusBadge from '../components/StatusBadge';

export function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    let isSubscribed = true;

    async function loadInitialLogs() {
      try {
        setLoading(true);
        const res = await getAuditLogs({ limit: 100 });
        if (isSubscribed && res?.data) {
          setLogs(res.data);
        }
      } catch (err) {
        if (isSubscribed) {
          setError(err.message || 'Failed to fetch audit log trail');
        }
      } finally {
        if (isSubscribed) {
          setLoading(false);
        }
      }
    }

    loadInitialLogs();

    return () => {
      isSubscribed = false;
    };
  }, []);

  const filteredLogs = logs.filter(log => {
    if (filterType !== 'ALL' && log.event_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const entityMatch = log.entity_id?.toLowerCase().includes(q);
      const userMatch = (log.user_name || log.user_email || '').toLowerCase().includes(q);
      const typeMatch = log.event_type?.toLowerCase().includes(q);
      return entityMatch || userMatch || typeMatch;
    }
    return true;
  });

  const getEventBadgeType = (type) => {
    if (type?.includes('resolved') || type?.includes('completed')) return 'healthy';
    if (type?.includes('failed') || type?.includes('deleted')) return 'critical';
    if (type?.includes('assigned') || type?.includes('created')) return 'info';
    return 'neutral';
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

        <button className="btn btn-secondary" onClick={fetchLogs} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh Logs'}
        </button>
      </div>

      {/* Filter Bar */}
      <div className="panel" style={{ padding: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            className="input"
            placeholder="Search by Entity ID, user, or event..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Event Filter:</span>
          <select
            className="input"
            style={{ width: 'auto' }}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="ALL">All Event Types</option>
            <option value="scan_created">Scan Created</option>
            <option value="scan_completed">Scan Completed</option>
            <option value="scan_failed">Scan Failed</option>
            <option value="incident_created">Incident Created</option>
            <option value="incident_assigned">Incident Assigned</option>
            <option value="incident_status_changed">Status Changed</option>
            <option value="incident_action_logged">Action Logged</option>
            <option value="incident_resolved">Incident Resolved</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="panel" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)' }}>Loading forensic audit trail...</p>
        </div>
      ) : error ? (
        <div className="panel" style={{ padding: '24px', borderLeft: '4px solid var(--status-critical)' }}>
          <h4 style={{ color: 'var(--status-critical)', marginBottom: '6px' }}>Audit Query Failed</h4>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{error}</p>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="panel" style={{ padding: '48px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>No audit events found matching the selected filter criteria.</p>
        </div>
      ) : (
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th>Timestamp (UTC)</th>
                <th>Event Type</th>
                <th>Target Entity</th>
                <th>Entity ID</th>
                <th>Attributed User</th>
                <th style={{ textAlign: 'right' }}>Inspection</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log, idx) => (
                <tr key={log.audit_id || `${log.created_at || 'audit'}-${idx}`}>
                  <td style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {new Date(log.created_at).toISOString().replace('T', ' ').slice(0, 19)}
                  </td>
                  <td>
                    <StatusBadge type={getEventBadgeType(log.event_type)}>
                      {log.event_type}
                    </StatusBadge>
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                    {log.entity_type || 'system'}
                  </td>
                  <td style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {log.entity_id ? `${log.entity_id.slice(0, 8)}...` : 'N/A'}
                  </td>
                  <td style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                    {log.user_name || log.user_email || 'System / Auto'}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '4px 8px', fontSize: '11px' }}
                      onClick={() => setSelectedLog(log)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* JSON Metadata Inspector Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Audit Event Details</h3>
              <button className="btn-close" onClick={() => setSelectedLog(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Event Type:</span>
                <StatusBadge type={getEventBadgeType(selectedLog.event_type)}>{selectedLog.event_type}</StatusBadge>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Entity Reference:</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedLog.entity_type} ({selectedLog.entity_id})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Recorded At:</span>
                <span>{selectedLog.created_at}</span>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                  Metadata JSON Payload:
                </span>
                <pre style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-app)',
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  overflowX: 'auto',
                  maxHeight: '240px'
                }}>
                  {JSON.stringify(selectedLog.metadata || {}, null, 2)}
                </pre>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AuditLogsPage;
