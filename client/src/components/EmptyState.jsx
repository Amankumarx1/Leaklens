import React from 'react';

export function EmptyState({ 
  title = 'No Data Available', 
  description,
  message,
  actionText,
  actionLabel, 
  onAction,
  icon
}) {
  const resolvedDescription = description || message || 'No scans or exposure findings have been recorded yet.';
  const resolvedActionText = actionText || actionLabel;

  return (
    <div 
      className="empty-state"
      style={{
        textAlign: 'center',
        padding: '52px 28px',
        background: 'rgba(255, 255, 255, 0.65)',
        backdropFilter: 'var(--glass-blur-light)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid rgba(255, 255, 255, 0.85)',
        boxShadow: 'var(--shadow-glass-sm)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '12px 0'
      }}
    >
      <div 
        className="empty-state-icon"
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(254, 215, 170, 0.6), rgba(226, 212, 253, 0.6))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent-cyan)',
          marginBottom: '16px'
        }}
      >
        {icon || (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="32" height="32">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      <h4 className="empty-state-title" style={{ fontSize: '18px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
        {title}
      </h4>
      <p className="empty-state-description" style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: 1.5, marginBottom: '20px' }}>
        {resolvedDescription}
      </p>
      {resolvedActionText && onAction && (
        <button className="btn btn-secondary" onClick={onAction}>
          {resolvedActionText}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
