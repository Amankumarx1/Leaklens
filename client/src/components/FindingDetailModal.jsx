import React from 'react';
import StatusBadge from './StatusBadge';

export function FindingDetailModal({ finding, onClose }) {
  if (!finding) return null;

  return (
    <div style={{
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
    }}>
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
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Exposure Finding Details</h3>
            <StatusBadge type={finding.severity === 'critical' ? 'danger' : finding.severity === 'high' ? 'warning' : 'info'}>
              {finding.severity?.toUpperCase()}
            </StatusBadge>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '14px' }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>FINDING IDENTIFIER</div>
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>{finding.finding_id}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>DETECTION CATEGORY</div>
            <div style={{ fontWeight: '600' }}>{finding.category}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>MASKED EXCERPT (DEFENSIVE REDACTION)</div>
            <div style={{
              background: 'var(--bg-app)',
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontFamily: 'var(--font-mono)',
              marginTop: '4px'
            }}>
              {finding.masked_excerpt}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Note: Plaintext secrets are strictly excluded from relational persistence and API responses.
            </p>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>LOCATION REFERENCE</div>
            <div style={{ fontFamily: 'var(--font-mono)' }}>{finding.location_reference}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>ASSOCIATED FILE</div>
            <div>{finding.original_filename || 'Target file'}</div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>DETECTION RULE & LIMITATIONS</div>
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>{finding.rule_name}</strong>
              {finding.rule_description && <div>{finding.rule_description}</div>}
            </div>
          </div>

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>DETECTED AT</div>
            <div>{new Date(finding.detected_at).toLocaleString()}</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          {onEscalate && (
            <button
              id="btn-modal-escalate"
              className="btn btn-secondary"
              style={{ color: 'var(--status-warning)' }}
              onClick={() => {
                onClose();
                onEscalate();
              }}
            >
              Escalate to Incident
            </button>
          )}
          <button className="btn btn-primary" onClick={onClose}>
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}

export default FindingDetailModal;
