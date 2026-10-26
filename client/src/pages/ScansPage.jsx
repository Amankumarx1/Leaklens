import React, { useState, useEffect, useCallback } from 'react';
import { getScans } from '../services/api';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import StatusBadge from '../components/StatusBadge';

export function ScansPage({ user, onNavigate }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchScansList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getScans();
      if (res?.success) {
        setScans(res.data || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to load historical scans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await getScans();
        if (!ignore && res?.success) {
          setScans(res.data || []);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load historical scans.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, []);

  const canScan = user?.role !== 'COMPLIANCE_REVIEWER';

  const filteredScans = scans.filter(scan => {
    if (statusFilter && scan.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const nameMatch = (scan.original_filename || '').toLowerCase().includes(q);
      const idMatch = (scan.scan_id || '').toLowerCase().includes(q);
      return nameMatch || idMatch;
    }
    return true;
  });

  return (
    <div>
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3>Authorized Scan Jobs</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Historical file inspection jobs, execution status, and persisted exposure findings.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              id="btn-scans-refresh"
              className="btn btn-secondary" 
              onClick={fetchScansList} 
              disabled={loading}
              title="Refresh scan list"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
            {canScan && (
              <button
                id="btn-nav-new-scan"
                className="btn btn-primary"
                onClick={() => onNavigate('scans-new')}
              >
                + New File Scan
              </button>
            )}
          </div>
        </div>

        {/* Filter Toolbar */}
        <div style={{
          display: 'flex',
          gap: '12px',
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--bg-app)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          border: '1px solid var(--border-subtle)'
        }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by filename or Scan ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-muted)' }}>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px'
              }}
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="in_progress">In Progress</option>
            </select>
          </div>

          {(statusFilter || searchQuery) && (
            <button
              className="btn btn-secondary"
              style={{ fontSize: '12px', padding: '4px 10px' }}
              onClick={() => {
                setStatusFilter('');
                setSearchQuery('');
              }}
            >
              Clear Filters
            </button>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {filteredScans.length} of {scans.length} scans
          </div>
        </div>

        {loading && scans.length === 0 ? (
          <LoadingState message="Loading scan execution records..." />
        ) : error && scans.length === 0 ? (
          <ErrorState title="Failed to Load Scans" message={error} onRetry={fetchScansList} />
        ) : filteredScans.length === 0 ? (
          <EmptyState
            title={scans.length === 0 ? "No Scans Executed Yet" : "No Matching Scans Found"}
            description={
              scans.length === 0
                ? "No files have been inspected. Upload an authorized file to evaluate against secret signatures."
                : "No scan jobs match your current search and status filter."
            }
            actionText={canScan && scans.length === 0 ? "Initiate First Scan" : null}
            onAction={canScan && scans.length === 0 ? () => onNavigate('scans-new') : null}
          />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 14px' }}>Scan ID</th>
                  <th style={{ padding: '12px 14px' }}>Target File</th>
                  <th style={{ padding: '12px 14px' }}>Size</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Findings</th>
                  <th style={{ padding: '12px 14px' }}>Executed At</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredScans.map((scan) => (
                  <tr
                    key={scan.scan_id}
                    style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                    className="hover-row"
                  >
                    <td style={{ padding: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)' }}>
                      {scan.scan_id.substring(0, 8)}...
                    </td>
                    <td style={{ padding: '14px', fontWeight: '500' }}>
                      {scan.original_filename || 'upload.txt'}
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-secondary)' }}>
                      {scan.file_size_bytes ? `${(scan.file_size_bytes / 1024).toFixed(1)} KB` : 'N/A'}
                    </td>
                    <td style={{ padding: '14px' }}>
                      <StatusBadge type={scan.status === 'completed' ? 'healthy' : scan.status === 'failed' ? 'danger' : 'warning'}>
                        {scan.status.toUpperCase()}
                      </StatusBadge>
                    </td>
                    <td style={{ padding: '14px' }}>
                      <span style={{
                        fontWeight: '700',
                        fontFamily: 'var(--font-mono)',
                        color: scan.total_findings > 0 ? 'var(--status-danger)' : 'var(--status-healthy)'
                      }}>
                        {scan.total_findings || 0}
                      </span>
                    </td>
                    <td style={{ padding: '14px', color: 'var(--text-muted)' }}>
                      {new Date(scan.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px', textAlign: 'right' }}>
                      <button
                        id={`btn-inspect-scan-${scan.scan_id}`}
                        className="btn btn-secondary"
                        style={{ fontSize: '12px', padding: '4px 10px' }}
                        onClick={() => onNavigate('scan-detail', scan.scan_id)}
                      >
                        Inspect →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default ScansPage;
