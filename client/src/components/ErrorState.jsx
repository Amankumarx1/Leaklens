import React from 'react';

export function ErrorState({ title = 'Error Loading Data', message, onRetry }) {
  return (
    <div className="empty-state" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
      <div className="empty-state-icon" style={{ color: 'var(--status-danger)' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h4 className="empty-state-title" style={{ color: 'var(--status-danger)' }}>{title}</h4>
      <p className="empty-state-description">{message || 'An unexpected error occurred while communicating with the server.'}</p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          Retry Connection
        </button>
      )}
    </div>
  );
}

export default ErrorState;
