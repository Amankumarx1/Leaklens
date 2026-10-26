import React from 'react';

export function LoadingState({ message = 'Loading security data...' }) {
  return (
    <div className="state-center">
      <div className="spinner" />
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{message}</p>
    </div>
  );
}

export default LoadingState;
