import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

describe('Frontend Application Shell & Navigation Structure', () => {
  const clientSrc = path.join(rootDir, 'client', 'src');

  it('should have all required components and page files present', () => {
    const requiredFiles = [
      path.join(clientSrc, 'App.jsx'),
      path.join(clientSrc, 'main.jsx'),
      path.join(clientSrc, 'index.css'),
      path.join(clientSrc, 'components', 'Header.jsx'),
      path.join(clientSrc, 'components', 'Sidebar.jsx'),
      path.join(clientSrc, 'components', 'EmptyState.jsx'),
      path.join(clientSrc, 'components', 'LoadingState.jsx'),
      path.join(clientSrc, 'components', 'ErrorState.jsx'),
      path.join(clientSrc, 'components', 'StatusBadge.jsx'),
      path.join(clientSrc, 'layouts', 'AppLayout.jsx'),
      path.join(clientSrc, 'pages', 'DashboardPage.jsx'),
      path.join(clientSrc, 'pages', 'ScansPage.jsx'),
      path.join(clientSrc, 'pages', 'FindingsPage.jsx'),
      path.join(clientSrc, 'pages', 'IncidentsPage.jsx'),
      path.join(clientSrc, 'pages', 'AnalyticsPage.jsx'),
      path.join(clientSrc, 'pages', 'AuditLogsPage.jsx'),
      path.join(clientSrc, 'pages', 'SettingsPage.jsx'),
      path.join(clientSrc, 'services', 'api.js'),
      path.join(clientSrc, 'hooks', 'useHealth.js')
    ];

    for (const file of requiredFiles) {
      expect(fs.existsSync(file), `Missing required frontend file: ${file}`).toBe(true);
    }
  });

  it('should register all 7 functional navigation routes in Sidebar and App', () => {
    const sidebarContent = fs.readFileSync(path.join(clientSrc, 'components', 'Sidebar.jsx'), 'utf8');
    const appContent = fs.readFileSync(path.join(clientSrc, 'App.jsx'), 'utf8');

    const expectedRoutes = [
      'dashboard',
      'scans',
      'findings',
      'incidents',
      'analytics',
      'audit-logs',
      'settings'
    ];

    for (const route of expectedRoutes) {
      expect(sidebarContent).toContain(`id: '${route}'`);
      expect(appContent).toContain(`case '${route}':`);
    }
  });

  it('should maintain honest empty state and not fabricate security metrics', () => {
    const dashboardContent = fs.readFileSync(path.join(clientSrc, 'pages', 'DashboardPage.jsx'), 'utf8');

    // Asserts honest zero-metric display in Phase 1
    expect(dashboardContent).toContain('Completed Scans');
    expect(dashboardContent).toContain('Awaiting first scan job');
    expect(dashboardContent).toContain('Exposures Detected');
    expect(dashboardContent).toContain('No findings recorded');
    expect(dashboardContent).toContain('Open Incidents');
    expect(dashboardContent).toContain('Zero active triage cases');
    expect(dashboardContent).toContain('No Exposure Telemetry Recorded');
  });

  it('should configure shared API client with environment fallback', () => {
    const apiContent = fs.readFileSync(path.join(clientSrc, 'services', 'api.js'), 'utf8');
    expect(apiContent).toContain('import.meta.env.VITE_API_URL');
    expect(apiContent).toContain('/health');
  });
});
