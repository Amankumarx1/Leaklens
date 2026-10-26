import React, { useEffect } from 'react';
import StatusBadge from './StatusBadge';

export function FindingDetailModal({ finding, onClose, onEscalate }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!finding) return null;

  return (
    <div 
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-content" style={{ maxWidth: '600px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Exposure Finding Details</h3>
            <StatusBadge type={finding.severity === 'critical' ? 'danger' : finding.severity === 'high' ? 'warning' : 'info'}>
              {finding.severity?.toUpperCase()}
            </StatusBadge>
            <StatusBadge type={finding.confidence === 'high' ? 'healthy' : finding.confidence === 'medium' ? 'warning' : 'neutral'}>
              CONF: {(finding.confidence || 'high').toUpperCase()}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>FINDING IDENTIFIER</div>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '12px' }}>{finding.finding_id}</div>
            </div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>DETECTION CATEGORY</div>
              <div style={{ fontWeight: '600' }}>{finding.category}</div>
            </div>
          </div>

          {finding.field_path && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>STRUCTURED FIELD PATH</div>
              <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', fontSize: '12px' }}>
                <code>{finding.field_path}</code>
              </div>
            </div>
          )}

          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>MASKED EXCERPT (DEFENSIVE REDACTION)</div>
            <div style={{
              background: 'rgba(255, 255, 255, 0.65)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-glass-light)',
              fontFamily: 'var(--font-mono)',
              marginTop: '4px'
            }}>
              {finding.masked_excerpt}
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Note: Plaintext secrets are strictly excluded from relational persistence and API responses.
            </p>
          </div>

          {finding.secret_fingerprint && (
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: '11px', textTransform: 'uppercase' }}>HMAC-SHA256 FINGERPRINT (SALTED)</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)' }}>
                {finding.secret_fingerprint.slice(0, 32)}...
              </div>
            </div>
          )}

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
