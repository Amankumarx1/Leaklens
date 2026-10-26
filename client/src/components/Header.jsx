import React from 'react';
import StatusBadge from './StatusBadge';

export function Header({ activeRouteTitle, health, loading, error, onRefresh, user, onLogout }) {
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
      statusText = `API Up | DB ${health.components?.database?.status || 'Standalone'}`;
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
          Ping
        </button>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid var(--border-medium)' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '12px', fontWeight: '600' }}>{user.display_name || user.email}</div>
              <StatusBadge type={user.role === 'ADMIN' ? 'danger' : user.role === 'ANALYST' ? 'info' : 'warning'}>
                {user.role}
              </StatusBadge>
            </div>

            <button
              id="btn-logout"
              className="btn btn-secondary"
              onClick={onLogout}
              style={{ fontSize: '11px', padding: '6px 10px' }}
              title="Sign out of LeakLens session"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
