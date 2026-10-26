import React from 'react';
import StatusBadge from '../components/StatusBadge';

export function FindingsPage() {
  return (
    <div className="dev-placeholder">
      <div className="dev-badge-row">
        <StatusBadge type="info">Phase 2 Scheduled</StatusBadge>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target: Exposure Triage & Redaction</span>
      </div>

      <h3>Exposure Findings & Masking</h3>
      <p>
        Detailed finding triage and evidence masking workflows are scheduled for Phase 2.
        The database schema (<code>leaklens.findings</code>) enforces that raw secrets (passwords, tokens, API keys) 
        are never stored in plaintext, mandating <code>masked_excerpt</code> and location references.
      </p>

      <div className="dev-feature-list">
        <h4>Planned Findings Capabilities (Phase 2)</h4>
        <ul>
          <li>Interactive findings table with severity and category filtering</li>
          <li>Cryptographically masked excerpts with contextual line offsets</li>
          <li>False-positive suppression and verification workflows</li>
          <li>One-click escalation to incident triage queues</li>
        </ul>
      </div>
    </div>
  );
}

export default FindingsPage;
