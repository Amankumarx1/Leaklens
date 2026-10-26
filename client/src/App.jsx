import React, { useState, useEffect } from 'react';
import AppLayout from './layouts/AppLayout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import ScansPage from './pages/ScansPage';
import NewScanPage from './pages/NewScanPage';
import ScanDetailPage from './pages/ScanDetailPage';
import FindingsPage from './pages/FindingsPage';
import IncidentsPage from './pages/IncidentsPage';
import NewIncidentPage from './pages/NewIncidentPage';
import IncidentDetailPage from './pages/IncidentDetailPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SettingsPage from './pages/SettingsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import useHealth from './hooks/useHealth';
import { getProfile, logout, getAuthToken } from './services/api';

const ROUTE_TITLES = {
  dashboard: 'Security Posture Dashboard',
  scans: 'File Exposure Scans',
  'scans-new': 'Upload & Scan File',
  'scan-detail': 'Scan Results & Evidence',
  findings: 'Sensitive-Data Findings Register',
  incidents: 'Incident Response & Remediation',
  'incidents-new': 'Create Security Incident',
  'incident-detail': 'Incident Response Workspace',
  'audit-logs': 'Defensive Audit Trail',
  settings: 'System Configuration',
  analytics: 'Security Posture Analytics & Power BI',
  'not-found': '404 — Page Not Found'
};

const VALID_ROUTES = [
  'dashboard',
  'scans',
  'scans-new',
  'scan-detail',
  'findings',
  'incidents',
  'incidents-new',
  'incident-detail',
  'audit-logs',
  'settings',
  'analytics'
];

function parseHashRoute() {
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  if (!hash) return { route: 'dashboard', paramId: null };
  const parts = hash.split('/');
  const route = parts[0] || 'dashboard';
  const paramId = parts[1] || null;
  return {
    route: VALID_ROUTES.includes(route) ? route : 'not-found',
    paramId
  };
}

function NotFoundPage({ onNavigate }) {
  return (
    <div className="panel" style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ fontSize: '56px', fontWeight: '800', color: 'var(--status-danger)', marginBottom: '12px' }}>
        404
      </div>
      <h3 style={{ fontSize: '20px', marginBottom: '8px' }}>Route Not Found</h3>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', maxWidth: '440px', margin: '0 auto 24px' }}>
        The requested navigation endpoint does not exist or has been relocated within the LeakLens defensive portal.
      </p>
      <button className="btn btn-primary" onClick={() => onNavigate('dashboard')}>
        ← Return to Security Dashboard
      </button>
    </div>
  );
}

export function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Initialize route from current URL hash
  const initial = parseHashRoute();
  const [activeRoute, setActiveRoute] = useState(initial.route);
  const [selectedScanId, setSelectedScanId] = useState(initial.route === 'scan-detail' ? initial.paramId : null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(initial.route === 'incident-detail' ? initial.paramId : null);
  const [selectedFindingId, setSelectedFindingId] = useState(initial.route === 'incidents-new' ? initial.paramId : null);

  const { health, loading: healthLoading, error: healthError, refetch: refetchHealth } = useHealth(20000);

  // Sync state with browser back/forward (hashchange / popstate)
  useEffect(() => {
    const handleHashChange = () => {
      const { route, paramId } = parseHashRoute();
      setActiveRoute(route);
      if (route === 'scan-detail' && paramId) setSelectedScanId(paramId);
      if (route === 'incident-detail' && paramId) setSelectedIncidentId(paramId);
      if (route === 'incidents-new' && paramId) setSelectedFindingId(paramId);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Check existing session on mount
  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const token = getAuthToken();
      if (!token) {
        if (isMounted) setAuthChecking(false);
        return;
      }

      try {
        const res = await getProfile();
        if (isMounted && res?.success && res?.data?.user) {
          setUser(res.data.user);
        }
      } catch {
        // Token invalid or expired
        if (isMounted) setUser(null);
      } finally {
        if (isMounted) setAuthChecking(false);
      }
    }

    checkSession();
    return () => { isMounted = false; };
  }, []);

  const handleNavigate = (route, paramId = null) => {
    setActiveRoute(route);
    if (paramId) {
      if (route === 'scan-detail') setSelectedScanId(paramId);
      if (route === 'incident-detail') setSelectedIncidentId(paramId);
      if (route === 'incidents-new') setSelectedFindingId(paramId);
      window.location.hash = `#/${route}/${paramId}`;
    } else {
      window.location.hash = `#/${route}`;
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setActiveRoute('dashboard');
    window.location.hash = '#/dashboard';
  };

  // Render Login view if user is unauthenticated
  if (authChecking) {
    return (
      <div className="state-center" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-app)' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Verifying LeakLens Session...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage 
        onLoginSuccess={(authedUser) => {
          setUser(authedUser);
          const { route } = parseHashRoute();
          setActiveRoute(route === 'not-found' ? 'dashboard' : route);
        }} 
      />
    );
  }

  const renderCurrentPage = () => {
    switch (activeRoute) {
      case 'dashboard':
        return <DashboardPage health={health} user={user} onNavigate={handleNavigate} />;
      case 'scans':
        return <ScansPage user={user} onNavigate={handleNavigate} />;
      case 'scans-new':
        return <NewScanPage user={user} onNavigate={handleNavigate} />;
      case 'scan-detail':
        return <ScanDetailPage scanId={selectedScanId} onNavigate={handleNavigate} />;
      case 'findings':
        return <FindingsPage user={user} onNavigate={handleNavigate} />;
      case 'incidents':
        return <IncidentsPage user={user} onNavigate={handleNavigate} />;
      case 'incidents-new':
        return <NewIncidentPage user={user} onNavigate={handleNavigate} initialFindingId={selectedFindingId} />;
      case 'incident-detail':
        return <IncidentDetailPage incidentId={selectedIncidentId} user={user} onNavigate={handleNavigate} />;
      case 'audit-logs':
        return <AuditLogsPage />;
      case 'settings':
        return <SettingsPage health={health} user={user} onNavigate={handleNavigate} />;
      case 'analytics':
        return <AnalyticsPage onNavigate={handleNavigate} />;
      default:
        return <NotFoundPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <AppLayout
      activeRoute={activeRoute}
      onNavigate={handleNavigate}
      activeRouteTitle={ROUTE_TITLES[activeRoute] || 'LeakLens'}
      health={health}
      loading={healthLoading}
      error={healthError}
      onRefresh={refetchHealth}
      user={user}
      onLogout={handleLogout}
    >
      {renderCurrentPage()}
    </AppLayout>
  );
}

export default App;
