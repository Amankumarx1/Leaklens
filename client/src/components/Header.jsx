import React from 'react';

export function Header({ activeRouteTitle, health, loading, error, onRefresh }) {
  // Determine health indicator
  let statusText = 'Checking system...';
  let dotClass = 'degraded';

  if (loading && !health) {
    statusText = 'Verifying Services...';
  } else if (error) {
    statusText = 'Backend Offline';
    dotClass = 'error';
  } else if (health) {
    const isDbConnected = health.components?.database?.status === 'connected';
    if (health.status === 'healthy' && isDbConnected) {
      statusText = `Operational (${health.components.database.latencyMs || 0}ms)`;
      dotClass = 'healthy';
    } else {
      statusText = `API Up | DB ${health.components?.database?.status || 'Offline'}`;
      dotClass = 'degraded';
    }
  }

  return (
    <header className="app-header">
      <div className="header-title-zone">
        <h2>{activeRouteTitle}</h2>
      </div>

      <div className="header-actions">
        <div className="health-pill" title={error || (health ? JSON.stringify(health.components) : '')}>
          <span className={`health-dot ${dotClass}`} />
          <span>{statusText}</span>
        </div>

        <button 
          id="btn-health-refresh"
          className="btn btn-secondary" 
          onClick={onRefresh}
          title="Refresh connection status"
          style={{ padding: '6px 12px', fontSize: '12px' }}
        >
          Check API
        </button>
      </div>
    </header>
  );
}

export default Header;
