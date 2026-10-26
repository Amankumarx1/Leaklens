import React from 'react';
import StatusBadge from '../components/StatusBadge';

export function AnalyticsPage() {
  return (
    <div className="dev-placeholder">
      <div className="dev-badge-row">
        <StatusBadge type="info">Phase 3 Scheduled</StatusBadge>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Target: Power BI & Exposure Intelligence</span>
      </div>

      <h3>Security Analytics & Exposure Reporting</h3>
      <p>
        Executive exposure analytics and external reporting integration are scheduled for Phase 3.
        The preliminary database view <code>leaklens.vw_exposure_analytics</code> has already been created 
        to supply aggregated metrics across secret categories, severity tiers, and remediation status 
        without row multiplication anomalies.
      </p>

      <div className="dev-feature-list">
        <h4>Planned Analytics Capabilities (Phase 3)</h4>
        <ul>
          <li>Interactive trend visualizations by secret category (API keys, PII, credentials)</li>
          <li>Mean Time to Remediation (MTTR) calculation and tracking</li>
          <li>Power BI DirectQuery integration via <code>vw_exposure_analytics</code></li>
          <li>Exportable compliance summaries (PDF/CSV/JSON)</li>
        </ul>
      </div>
    </div>
  );
}

export default AnalyticsPage;
