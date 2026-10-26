import React, { useState, useEffect } from 'react';
import { getScanById, getScanFindings } from '../services/api';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import StatusBadge from '../components/StatusBadge';

export function ScanDetailPage({ scanId, onNavigate }) {
  const [scan, setScan] = useState(null);
  const [findings, setFindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const [scanRes, findingsRes] = await Promise.all([
          getScanById(scanId),
          getScanFindings(scanId)
        ]);

        if (isMounted) {
          if (scanRes?.success) setScan(scanRes.data);
          if (findingsRes?.success) setFindings(findingsRes.data || []);
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (scanId) {
      loadData();
    }

    return () => { isMounted = false; };
  }, [scanId]);

  if (loading) return <LoadingState message="Loading scan execution evidence..." />;
  if (error) return <ErrorState title="Error Loading Scan" message={error} onRetry={() => onNavigate('scans')} />;
  if (!scan) return <ErrorState title="Scan Not Found" message={`Scan with ID ${scanId} was not found.`} onRetry={() => onNavigate('scans')} />;

  const criticalCount = findings.filter(f => f.severity === 'critical').length;
  const highCount = findings.filter(f => f.severity === 'high').length;
  const mediumCount = findings.filter(f => f.severity === 'medium').length;
  const lowCount = findings.filter(f => f.severity === 'low').length;

  return (
    <div>
      {/* Top Navigation */}
      <div style={{ marginBottom: '16px' }}>
        <button className="btn btn-secondary" onClick={() => onNavigate('scans')}>
          ← Back to Scans List
        </button>
      </div>

      {/* Header Panel */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h3 style={{ fontSize: '18px' }}>{scan.original_filename || 'File Inspection'}</h3>
              <StatusBadge type={scan.status === 'completed' ? 'healthy' : scan.status === 'failed' ? 'danger' : 'warning'}>
                {scan.status.toUpperCase()}
              </StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '4px' }}>
              Scan ID: {scan.scan_id}
            </p>
          </div>

          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '24px', fontWeight: '800', fontFamily: 'var(--font-mono)', color: findings.length > 0 ? 'var(--status-danger)' : 'var(--status-healthy)' }}>
              {findings.length}
            </span>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Exposures
            </div>
          </div>
        </div>

        {/* Metadata Details */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          background: 'var(--bg-app)',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-subtle)',
          fontSize: '12px'
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>FILE SIZE</div>
            <div>{scan.file_size_bytes ? `${(scan.file_size_bytes / 1024).toFixed(1)} KB` : 'N/A'}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>MIME TYPE</div>
            <div>{scan.mime_type || 'text/plain'}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>SHA-256 DIGEST</div>
            <div style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>{scan.content_hash || 'N/A'}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>STARTED AT</div>
            <div>{new Date(scan.started_at || scan.created_at).toLocaleString()}</div>
          </div>
        </div>

        {/* Severity Summary Pills */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          <span className="badge badge-danger">Critical: {criticalCount}</span>
          <span className="badge badge-warning">High: {highCount}</span>
          <span className="badge badge-info">Medium: {mediumCount}</span>
          <span className="badge badge-healthy">Low: {lowCount}</span>
        </div>
      </div>

      {/* Findings Table Panel */}
      <div className="panel">
        <div className="panel-header">
          <h3>Detected Sensitive-Data Findings ({findings.length})</h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Masked for Defense</span>
        </div>

        {findings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
            No sensitive data patterns were detected in this file.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 14px' }}>Category</th>
                  <th style={{ padding: '10px 14px' }}>Severity</th>
                  <th style={{ padding: '10px 14px' }}>Location</th>
                  <th style={{ padding: '10px 14px' }}>Redacted / Masked Excerpt</th>
                  <th style={{ padding: '10px 14px' }}>Rule</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => (
                  <tr key={finding.finding_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 14px', fontWeight: '500' }}>
                      {finding.category}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <StatusBadge type={finding.severity === 'critical' ? 'danger' : finding.severity === 'high' ? 'warning' : 'info'}>
                        {finding.severity.toUpperCase()}
                      </StatusBadge>
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)' }}>
                      {finding.location_reference}
                    </td>
                    <td style={{ padding: '12px 14px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      <code style={{ background: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                        {finding.masked_excerpt}
                      </code>
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {finding.rule_name}
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

export default ScanDetailPage;
