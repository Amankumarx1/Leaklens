import React, { useState, useRef, useEffect } from 'react';
import StatusBadge from './StatusBadge';

export function Header({ activeRouteTitle, health, loading, error, onRefresh, user, onLogout, onNavigate }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const menuRef = useRef(null);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

  const handleGlobalSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim() && onNavigate) {
      onNavigate('findings');
      setSearchQuery('');
    }
  };

  return (
    <header className="app-header">
      <div className="header-title-zone" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <h2>{activeRouteTitle}</h2>

        {/* Global Quick Search Bar */}
        <form onSubmit={handleGlobalSearch} style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
          <div style={{ position: 'relative' }}>
            <input
              id="input-global-search"
              type="text"
              placeholder="Jump to findings / rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: 'var(--bg-app)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text-primary)',
                fontSize: '12px',
                padding: '5px 28px 5px 10px',
                width: '180px',
                outline: 'none',
                transition: 'width 0.2s, border-color 0.2s'
              }}
              onFocus={(e) => { e.target.style.width = '240px'; e.target.style.borderColor = 'var(--accent-cyan)'; }}
              onBlur={(e) => { if (!searchQuery) e.target.style.width = '180px'; e.target.style.borderColor = 'var(--border-medium)'; }}
            />
            <button
              type="submit"
              title="Search"
              style={{
                position: 'absolute',
                right: '4px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px 4px'
              }}
            >
              🔍
            </button>
          </div>
        </form>
      </div>

      <div className="header-actions">
        {/* Health status pill */}
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

        {/* User profile with interactive dropdown menu */}
        {user && (
          <div ref={menuRef} style={{ position: 'relative', marginLeft: '12px', paddingLeft: '12px', borderLeft: '1px solid var(--border-medium)' }}>
            <button
              id="btn-user-menu-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'right'
              }}
              aria-expanded={menuOpen}
              aria-label="User profile and settings menu"
            >
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {user.display_name || user.email}
                </div>
                <StatusBadge type={user.role === 'ADMIN' ? 'danger' : user.role === 'ANALYST' ? 'info' : 'warning'}>
                  {user.role}
                </StatusBadge>
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: '2px' }}>▼</span>
            </button>

            {menuOpen && (
              <div
                id="user-profile-dropdown"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '8px',
                  backgroundColor: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-card)',
                  minWidth: '220px',
                  zIndex: 1000,
                  padding: '8px 0',
                  fontSize: '13px'
                }}
              >
                <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{user.display_name || 'Security Operator'}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.email}</div>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--accent-cyan)' }}>
                      Role: {user.role}
                    </span>
                  </div>
                </div>

                {onNavigate && (
                  <>
                    <button
                      id="menu-item-settings"
                      className="nav-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate('settings');
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      ⚙️ System Settings & Posture
                    </button>

                    <button
                      id="menu-item-analytics"
                      className="nav-item"
                      onClick={() => {
                        setMenuOpen(false);
                        onNavigate('analytics');
                      }}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '8px 16px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      📊 Analytics & Power BI
                    </button>
                  </>
                )}

                <div style={{ borderTop: '1px solid var(--border-subtle)', margin: '4px 0' }} />

                <button
                  id="btn-logout"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '8px 16px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--status-danger)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
