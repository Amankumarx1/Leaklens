import React from 'react';

const GENERAL_ITEMS = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    matchRoutes: ['dashboard'],
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
      </svg>
    )
  },
  {
    id: 'scans',
    label: 'Scans',
    matchRoutes: ['scans', 'scan-detail'],
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    )
  },
  {
    id: 'scans-new',
    label: '+ Scan File',
    matchRoutes: ['scans-new'],
    restrictedRoles: ['COMPLIANCE_REVIEWER'],
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    )
  },
  {
    id: 'findings',
    label: 'Findings',
    matchRoutes: ['findings'],
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    )
  }
];

const OPERATION_ITEMS = [
  {
    id: 'incidents',
    label: 'Incidents',
    matchRoutes: ['incidents', 'incident-detail', 'incidents-new'],
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  },
  {
    id: 'audit-logs',
    label: 'Audit Logs',
    matchRoutes: ['audit-logs'],
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    )
  },
  {
    id: 'settings',
    label: 'Settings',
    matchRoutes: ['settings'],
    icon: (
      <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )
  }
];

export function Sidebar({ activeRoute, onNavigate, user }) {
  const isCompliance = user?.role === 'COMPLIANCE_REVIEWER';

  const renderNavGroup = (items) => {
    return items.map(item => {
      if (item.restrictedRoles && item.restrictedRoles.includes(user?.role)) {
        return null;
      }

      const isActive = item.matchRoutes 
        ? item.matchRoutes.includes(activeRoute) 
        : activeRoute === item.id;

      return (
        <button
          key={item.id}
          id={`nav-link-${item.id}`}
          className={`nav-item ${isActive ? 'active' : ''}`}
          onClick={() => onNavigate(item.id)}
          aria-current={isActive ? 'page' : undefined}
          title={`Navigate to ${item.label}`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      );
    });
  };

  return (
    <aside className="app-sidebar">
      {/* LeakLens Defensive Security Brand Header */}
      <button
        id="btn-sidebar-brand"
        className="sidebar-brand"
        onClick={() => onNavigate('dashboard')}
        title="Return to Security Dashboard"
        aria-label="LeakLens Defensive Security Dashboard"
      >
        <div className="brand-orb" aria-hidden="true">
          <img 
            src="/logo-icon.png" 
            alt="LeakLens Logo" 
            style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
          />
        </div>
        <div className="brand-text">
          <h1>Leak<span style={{ color: '#ff4b55' }}>Lens</span></h1>
          <p>Defensive Security</p>
        </div>
      </button>

      <nav className="sidebar-menu" aria-label="Main Navigation">
        <div className="sidebar-section-label">General</div>
        {renderNavGroup(GENERAL_ITEMS)}

        <div className="sidebar-section-label" style={{ marginTop: '14px' }}>Operations</div>
        {renderNavGroup(OPERATION_ITEMS)}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--text-muted)' }}>Role</span>
          <strong style={{ color: 'var(--text-primary)' }}>{user?.role || 'Guest'}</strong>
        </div>
        <div style={{ color: isCompliance ? 'var(--status-warning)' : 'var(--status-healthy)', marginTop: '4px', fontWeight: 600 }}>
          {isCompliance ? 'Read-Only Audit' : 'Active Scanner Mode'}
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
