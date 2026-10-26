import React, { useState } from 'react';
import AppLayout from './layouts/AppLayout';
import DashboardPage from './pages/DashboardPage';
import ScansPage from './pages/ScansPage';
import FindingsPage from './pages/FindingsPage';
import IncidentsPage from './pages/IncidentsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import AuditLogsPage from './pages/AuditLogsPage';
import SettingsPage from './pages/SettingsPage';
import useHealth from './hooks/useHealth';

const ROUTE_TITLES = {
  dashboard: 'Security Posture Dashboard',
  scans: 'File Exposure Scans',
  findings: 'Detection Findings & Masking',
  incidents: 'Incident Response & Containment',
  analytics: 'Security Exposure Analytics',
  'audit-logs': 'Defensive Audit Trail',
  settings: 'System Configuration'
};

export function App() {
  const [activeRoute, setActiveRoute] = useState('dashboard');
  const { health, loading, error, refetch } = useHealth(20000);

  const renderCurrentPage = () => {
    switch (activeRoute) {
      case 'dashboard':
        return <DashboardPage health={health} onNavigate={setActiveRoute} />;
      case 'scans':
        return <ScansPage />;
      case 'findings':
        return <FindingsPage />;
      case 'incidents':
        return <IncidentsPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'audit-logs':
        return <AuditLogsPage />;
      case 'settings':
        return <SettingsPage health={health} />;
      default:
        return <DashboardPage health={health} onNavigate={setActiveRoute} />;
    }
  };

  return (
    <AppLayout
      activeRoute={activeRoute}
      onNavigate={setActiveRoute}
      activeRouteTitle={ROUTE_TITLES[activeRoute] || 'LeakLens'}
      health={health}
      loading={loading}
      error={error}
      onRefresh={refetch}
    >
      {renderCurrentPage()}
    </AppLayout>
  );
}

export default App;
