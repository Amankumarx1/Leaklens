import React from 'react';

const BADGE_STYLES = {
  healthy: { background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)' },
  success: { background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)' },
  danger: { background: 'rgba(239, 68, 68, 0.12)', color: '#e11d48', border: '1px solid rgba(239, 68, 68, 0.25)' },
  critical: { background: 'rgba(239, 68, 68, 0.12)', color: '#e11d48', border: '1px solid rgba(239, 68, 68, 0.25)' },
  warning: { background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.25)' },
  high: { background: 'rgba(245, 158, 11, 0.12)', color: '#d97706', border: '1px solid rgba(245, 158, 11, 0.25)' },
  info: { background: 'rgba(14, 165, 233, 0.12)', color: '#0284c7', border: '1px solid rgba(14, 165, 233, 0.25)' },
  neutral: { background: 'rgba(100, 116, 139, 0.12)', color: '#475569', border: '1px solid rgba(100, 116, 139, 0.25)' }
};

export function StatusBadge({ status, type = 'info', children }) {
  const resolvedStyle = BADGE_STYLES[type?.toLowerCase()] || BADGE_STYLES.info;
  const badgeClass = `badge badge-${type}`;

  return (
    <span
      className={badgeClass}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: '700',
        letterSpacing: '0.02em',
        textTransform: 'uppercase',
        ...resolvedStyle
      }}
    >
      {children || status}
    </span>
  );
}

export default StatusBadge;
