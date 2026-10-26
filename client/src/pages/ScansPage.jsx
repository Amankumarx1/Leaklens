import React, { useState, useEffect } from 'react';
import { getScans } from '../services/api';
import LoadingState from '../components/LoadingState';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import StatusBadge from '../components/StatusBadge';

export function ScansPage({ user, onNavigate }) {
  const [scans, setScans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadScans() {
      try {
        setError(null);
        const res = await getScans();
        if (isMounted && res?.success) {
          setScans(res.data || []);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadScans();
    return () => { isMounted = false; };
  }, []);

  const canScan = user?.role !== 'COMPLIANCE_REVIEWER';

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
            <button className="btn btn-secondary" onClick={fetchScansList} title="Refresh scan list">
              Refresh
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

        {loading ? (
          <LoadingState message="Loading scan execution records..." />
        ) : error ? (
          <ErrorState title="Failed to Load Scans" message={error} onRetry={fetchScansList} />
        ) : scans.length === 0 ? (
          <EmptyState
            title="No Scans Executed Yet"
            description="No files have been inspected. Upload an authorized file to evaluate against secret signatures."
            actionText={canScan ? "Initiate First Scan" : null}
            onAction={canScan ? () => onNavigate('scans-new') : null}
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
                {scans.map((scan) => (
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
