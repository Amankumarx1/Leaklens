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
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        {/* Global Quick Search Bar */}
        <form onSubmit={handleGlobalSearch} style={{ display: 'flex', alignItems: 'center', margin: 0 }}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '13px', pointerEvents: 'none' }}>
              🔍
            </span>
            <input
              id="input-global-search"
              type="text"
              className="glass-search-input"
              placeholder="Jump to findings / rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </form>

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
          style={{ padding: '8px 14px', fontSize: '12px', borderRadius: 'var(--radius-pill)' }}
        >
          Ping
        </button>

        {/* Quick notification circular icon */}
        <div
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.7)',
            border: '1px solid rgba(255, 255, 255, 0.85)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            cursor: 'pointer'
          }}
          title="Active Telemetry Notifications"
        >
          🔔
        </div>

        {/* User profile with interactive dropdown menu */}
        {user && (
          <div ref={menuRef} style={{ position: 'relative' }}>
            <button
              id="btn-user-menu-trigger"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{
                background: 'rgba(255, 255, 255, 0.8)',
                border: '1px solid rgba(255, 255, 255, 0.9)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '5px 12px 5px 6px',
                borderRadius: 'var(--radius-pill)',
                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.04)'
              }}
              aria-expanded={menuOpen}
              aria-label="User profile and settings menu"
            >
              <div
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fbcfe8, #a7f3d0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#1e293b'
                }}
              >
                {(user.display_name || user.email || 'U').charAt(0).toUpperCase()}
              </div>

              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                  {user.display_name || user.email}
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {user.role}
                </div>
              </div>
              <span style={{ fontSize: '9px', color: 'var(--text-muted)' }}>▼</span>
            </button>

            {menuOpen && (
              <div
                id="user-profile-dropdown"
                style={{
                  position: 'absolute',
                  right: 0,
                  top: '100%',
                  marginTop: '10px',
                  backgroundColor: 'var(--glass-surface-ultra)',
                  backdropFilter: 'var(--glass-blur-heavy)',
                  border: '1px solid var(--border-glass-strong)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-glass-lg)',
                  minWidth: '240px',
                  zIndex: 1000,
                  padding: '10px 0',
                  fontSize: '13px'
                }}
              >
                <div style={{ padding: '12px 18px', borderBottom: '1px solid rgba(226, 232, 240, 0.7)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                    <img src="/logo-icon.png" alt="LeakLens" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                    <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{user.display_name || 'Security Operator'}</div>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user.email}</div>
                  <div style={{ marginTop: '6px' }}>
                    <StatusBadge type={user.role === 'ADMIN' ? 'danger' : user.role === 'ANALYST' ? 'info' : 'warning'}>
                      {user.role}
                    </StatusBadge>
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
                        padding: '10px 18px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        borderRadius: 0
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
                        padding: '10px 18px',
                        background: 'none',
                        border: 'none',
                        color: 'var(--text-primary)',
                        cursor: 'pointer',
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        borderRadius: 0
                      }}
                    >
                      📊 Analytics & Power BI
                    </button>
                  </>
                )}

                <div style={{ borderTop: '1px solid rgba(226, 232, 240, 0.7)', margin: '6px 0' }} />

                <button
                  id="btn-logout"
                  onClick={() => {
                    setMenuOpen(false);
                    onLogout();
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 18px',
                    background: 'none',
                    border: 'none',
                    color: 'var(--status-danger)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
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
