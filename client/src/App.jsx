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
  settings: 'System Configuration'
};

export function App() {
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeRoute, setActiveRoute] = useState('dashboard');
  const [selectedScanId, setSelectedScanId] = useState(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState(null);
  const [selectedFindingId, setSelectedFindingId] = useState(null);

  const { health, loading: healthLoading, error: healthError, refetch: refetchHealth } = useHealth(20000);

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
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    setActiveRoute('dashboard');
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
          setActiveRoute('dashboard');
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
        return <SettingsPage health={health} />;
      default:
        return <DashboardPage health={health} user={user} onNavigate={handleNavigate} />;
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
