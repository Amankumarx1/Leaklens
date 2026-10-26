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
        <button className="btn-pill-filter active" onClick={() => onNavigate('scans')}>
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
          background: 'rgba(255, 255, 255, 0.45)',
          backdropFilter: 'blur(10px)',
          padding: '18px',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-glass-light)',
          fontSize: '12px'
        }}>
          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>FILE SIZE</div>
            <div style={{ fontWeight: '500' }}>{scan.file_size_bytes ? `${(scan.file_size_bytes / 1024).toFixed(1)} KB` : 'N/A'}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>MIME TYPE</div>
            <div style={{ fontWeight: '500' }}>{scan.mime_type || 'text/plain'}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>SHA-256 DIGEST</div>
            <div style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all', fontSize: '11px' }}>{scan.content_hash || 'N/A'}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', marginBottom: '4px', fontWeight: '600' }}>STARTED AT</div>
            <div style={{ fontWeight: '500' }}>{new Date(scan.started_at || scan.created_at).toLocaleString()}</div>
          </div>
        </div>

        {/* Severity Summary Pills */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          <StatusBadge type="danger">Critical: {criticalCount}</StatusBadge>
          <StatusBadge type="warning">High: {highCount}</StatusBadge>
          <StatusBadge type="info">Medium: {mediumCount}</StatusBadge>
          <StatusBadge type="healthy">Low: {lowCount}</StatusBadge>
        </div>
      </div>

      {/* Findings Table Panel */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3 style={{ margin: 0 }}>Detected Sensitive-Data Findings ({findings.length})</h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-muted)' }}>Masked and sanitized for defense in depth</p>
          </div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Automated Pattern Engine</span>
        </div>

        {findings.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-secondary)' }}>
            No sensitive data patterns were detected in this file.
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Location</th>
                  <th>Redacted / Masked Excerpt</th>
                  <th>Rule</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => (
                  <tr key={finding.finding_id}>
                    <td style={{ fontWeight: '600' }}>
                      {finding.category}
                    </td>
                    <td>
                      <StatusBadge type={finding.severity === 'critical' ? 'danger' : finding.severity === 'high' ? 'warning' : 'info'}>
                        {finding.severity.toUpperCase()}
                      </StatusBadge>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-pink)' }}>
                      {finding.location_reference}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '12px' }}>
                      <code style={{ background: 'rgba(255, 255, 255, 0.65)', padding: '3px 8px', borderRadius: '6px', border: '1px solid var(--border-glass-light)' }}>
                        {finding.masked_excerpt}
                      </code>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
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
