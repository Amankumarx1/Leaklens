import React from 'react';
import StatusBadge from '../components/StatusBadge';

export function ScansPage() {
  return (
    <div className="dev-placeholder">
      <div className="dev-badge-row">
        <StatusBadge type="info">Phase 2 Scheduled</StatusBadge>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target: Multi-file Pattern Ingestion</span>
      </div>

      <h3>Scans & Ingestion Engine</h3>
      <p>
        The file scanning engine and asynchronous batch worker are scheduled for Phase 2 implementation.
        The underlying relational tables (<code>leaklens.scan_jobs</code> and <code>leaklens.files</code>) 
        have been designed with SHA-256 deduplication and Azure Blob Storage reference fields.
      </p>

      <div className="dev-feature-list">
        <h4>Planned Scanning Capabilities (Phase 2)</h4>
        <ul>
          <li>Batch file upload and authorized directory traversal</li>
          <li>Streaming regex pattern matcher with entropy heuristics</li>
          <li>Content deduplication via SHA-256 cryptographic hashes</li>
          <li>Real-time scan progress indicators and error code reporting</li>
          <li>Automated finding persistence into <code>leaklens.findings</code></li>
        </ul>
      </div>
    </div>
  );
}

export default ScansPage;
