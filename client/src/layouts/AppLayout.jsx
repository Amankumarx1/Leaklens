import React from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';

export function AppLayout({ activeRoute, onNavigate, activeRouteTitle, health, loading, error, onRefresh, children }) {
  return (
    <div className="app-shell">
      <Sidebar activeRoute={activeRoute} onNavigate={onNavigate} />
      <div className="app-main">
        <Header 
          activeRouteTitle={activeRouteTitle} 
          health={health} 
          loading={loading} 
          error={error} 
          onRefresh={onRefresh} 
        />
        <main className="content-viewport">
          {children}
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
