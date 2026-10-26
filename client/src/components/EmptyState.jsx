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
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="48" height="48">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )}
      </div>
      <h4 className="empty-state-title">{title}</h4>
      <p className="empty-state-description">{resolvedDescription}</p>
      {resolvedActionText && onAction && (
        <button className="btn btn-secondary" onClick={onAction}>
          {resolvedActionText}
        </button>
      )}
    </div>
  );
}

export default EmptyState;
