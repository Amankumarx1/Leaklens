import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const clientSrc = path.join(rootDir, 'client', 'src');

describe('UI Functionality, Button Audit & Interactive Element Verification', () => {

  describe('1. Global Routing, Sidebar & Header Controls', () => {
    it('App.jsx must support hash navigation, history listeners, and 404 fallback', () => {
      const appContent = fs.readFileSync(path.join(clientSrc, 'App.jsx'), 'utf8');

      // Hash navigation & hashchange listener
      expect(appContent).toContain('window.location.hash');
      expect(appContent).toContain('addEventListener(\'hashchange\'');
      expect(appContent).toContain('window.location.hash =');

      // Registered routes
      expect(appContent).toContain('case \'dashboard\':');
      expect(appContent).toContain('case \'scans\':');
      expect(appContent).toContain('case \'scans-new\':');
      expect(appContent).toContain('case \'scan-detail\':');
      expect(appContent).toContain('case \'findings\':');
      expect(appContent).toContain('case \'incidents\':');
      expect(appContent).toContain('case \'incidents-new\':');
      expect(appContent).toContain('case \'incident-detail\':');
      expect(appContent).toContain('case \'audit-logs\':');
      expect(appContent).toContain('case \'settings\':');
      expect(appContent).toContain('case \'analytics\':');

      // 404 handler
      expect(appContent).toContain('Route Not Found');
      expect(appContent).toContain('Return to Security Dashboard');
    });

    it('Sidebar.jsx must make brand logo clickable and map sub-routes to active items correctly', () => {
      const sidebarContent = fs.readFileSync(path.join(clientSrc, 'components', 'Sidebar.jsx'), 'utf8');

      // Brand logo must be an interactive button navigating to dashboard
      expect(sidebarContent).toContain('onNavigate(\'dashboard\')');
      expect(sidebarContent).toContain('aria-label="LeakLens Defensive Security Dashboard"');

      // Sub-route matching: scan-detail -> scans, incident-detail -> incidents
      expect(sidebarContent).toContain('matchRoutes: [\'scans\', \'scan-detail\']');
      expect(sidebarContent).toContain('matchRoutes: [\'incidents\', \'incident-detail\', \'incidents-new\']');

      // Settings must NOT be hardcoded active
      expect(sidebarContent).not.toMatch(/item\.id === 'settings' \? 'active' : ''/);
      expect(sidebarContent).toContain('isActive ? \'active\' : \'\'');
    });

    it('Header.jsx must include global jump search and interactive user menu dropdown', () => {
      const headerContent = fs.readFileSync(path.join(clientSrc, 'components', 'Header.jsx'), 'utf8');

      // Global search bar
      expect(headerContent).toContain('placeholder="Jump to findings / rules..."');
      expect(headerContent).toContain('handleGlobalSearch');

      // User dropdown menu
      expect(headerContent).toContain('menuOpen');
      expect(headerContent).toContain('setMenuOpen');
      expect(headerContent).toContain('onNavigate(\'settings\')');
      expect(headerContent).toContain('onNavigate(\'analytics\')');
      expect(headerContent).toContain('onLogout');
      expect(headerContent).toContain('window.addEventListener(\'keydown\''); // Escape listener
    });
  });

  describe('2. Authentication & Form Controls', () => {
    it('LoginPage.jsx must provide functional password toggle and prevent page reload', () => {
      const loginContent = fs.readFileSync(path.join(clientSrc, 'pages', 'LoginPage.jsx'), 'utf8');

      // Password visibility state & toggle button
      expect(loginContent).toContain('showPassword');
      expect(loginContent).toContain('setShowPassword');
      expect(loginContent).toContain('type={showPassword ? \'text\' : \'password\'}');
      expect(loginContent).toContain('aria-label={showPassword ? \'Hide password\' : \'Show password\'}');

      // Proper submit handling & duplicate submit protection
      expect(loginContent).toContain('e.preventDefault()');
      expect(loginContent).toContain('disabled={loading}');
    });
  });

  describe('3. Scans & Upload Controls', () => {
    it('ScansPage.jsx must define fetchScansList and provide working filters', () => {
      const scansContent = fs.readFileSync(path.join(clientSrc, 'pages', 'ScansPage.jsx'), 'utf8');

      // UI-01: fetchScansList must be defined in outer component scope
      expect(scansContent).toContain('const fetchScansList = useCallback');
      expect(scansContent).toContain('onClick={fetchScansList}');

      // Filters and search controls
      expect(scansContent).toContain('statusFilter');
      expect(scansContent).toContain('searchQuery');
      expect(scansContent).toContain('Clear Filters');
      expect(scansContent).toContain('New File Scan');
    });

    it('NewScanPage.jsx must enforce MIME validation, size limit, and upload state transitions', () => {
      const uploadContent = fs.readFileSync(path.join(clientSrc, 'pages', 'NewScanPage.jsx'), 'utf8');

      expect(uploadContent).toContain('.txt,.json,.csv');
      expect(uploadContent).toContain('5 * 1024 * 1024'); // 5MB limit
      expect(uploadContent).toContain('Click to select or drag and drop a file');
      expect(uploadContent).toContain('uploadAndScanFile');
      expect(uploadContent).toContain('Remove');
    });
  });

  describe('4. Dashboard Telemetry & Navigation Actions', () => {
    it('DashboardPage.jsx must have interactive metric cards and recent telemetry links', () => {
      const dashboardContent = fs.readFileSync(path.join(clientSrc, 'pages', 'DashboardPage.jsx'), 'utf8');

      // Refresh button
      expect(dashboardContent).toContain('Refresh Telemetry');

      // Interactive metric cards with onNavigate
      expect(dashboardContent).toContain('role="button"');
      expect(dashboardContent).toContain('onNavigate(\'scans\')');
      expect(dashboardContent).toContain('onNavigate(\'findings\')');
      expect(dashboardContent).toContain('onNavigate(\'incidents\')');

      // Recent activity drill-down links
      expect(dashboardContent).toContain('Recent Scan Executions');
      expect(dashboardContent).toContain('Active Incident Response Desk');
      expect(dashboardContent).toContain('Inspect →');
      expect(dashboardContent).toContain('Workspace →');
    });
  });

  describe('5. Findings Search, Filters & Modal Actions', () => {
    it('FindingsPage.jsx must support live search, category, severity, and status filtering', () => {
      const findingsContent = fs.readFileSync(path.join(clientSrc, 'pages', 'FindingsPage.jsx'), 'utf8');

      expect(findingsContent).toContain('searchQuery');
      expect(findingsContent).toContain('categoryFilter');
      expect(findingsContent).toContain('severityFilter');
      expect(findingsContent).toContain('statusFilter');
      expect(findingsContent).toContain('Clear Filters');
      expect(findingsContent).toContain('filteredFindings');
    });

    it('FindingDetailModal.jsx must support Esc key, backdrop click, and incident escalation', () => {
      const modalContent = fs.readFileSync(path.join(clientSrc, 'components', 'FindingDetailModal.jsx'), 'utf8');

      expect(modalContent).toContain('onEscalate');
      expect(modalContent).toContain('Escalate to Incident');
      expect(modalContent).toContain('e.key === \'Escape\'');
      expect(modalContent).toContain('e.target === e.currentTarget');
    });
  });

  describe('6. Incident Management & Workflow Controls', () => {
    it('IncidentsPage.jsx must import useCallback and wire row navigation', () => {
      const incidentContent = fs.readFileSync(path.join(clientSrc, 'pages', 'IncidentsPage.jsx'), 'utf8');

      // UI-03: useCallback must be imported in React imports
      expect(incidentContent).toMatch(/import\s+React,\s*\{[^}]*useCallback[^}]*\}\s+from\s+'react'/);
      expect(incidentContent).toContain('const loadData = useCallback');

      // Row click navigation to detail view
      expect(incidentContent).toContain('onNavigate(\'incident-detail\', inc.incident_id)');
      expect(incidentContent).toContain('Clear Filters');
    });

    it('IncidentDetailPage.jsx must provide verified remediation, notes, and transition controls', () => {
      const detailContent = fs.readFileSync(path.join(clientSrc, 'pages', 'IncidentDetailPage.jsx'), 'utf8');

      expect(detailContent).toContain('handleStatusTransition');
      expect(detailContent).toContain('handleAddAction');
      expect(detailContent).toContain('handleRecordVerification');
      expect(detailContent).toContain('handleResolve');
      expect(detailContent).toContain('handleAssign');
    });
  });

  describe('7. Audit Trail Controls & Settings Workspace', () => {
    it('AuditLogsPage.jsx must wire fetchLogs, date filtering, and JSON forensic export', () => {
      const auditContent = fs.readFileSync(path.join(clientSrc, 'pages', 'AuditLogsPage.jsx'), 'utf8');

      // UI-02: fetchLogs must be defined and wired to refresh button
      expect(auditContent).toContain('const fetchLogs = useCallback');
      expect(auditContent).toContain('onClick={fetchLogs}');

      // Date filtering and forensic export
      expect(auditContent).toContain('dateFilter');
      expect(auditContent).toContain('handleExportJson');
      expect(auditContent).toContain('Export JSON');
      expect(auditContent).toContain('Clear Filters');
      expect(auditContent).toContain('referenceDate');
    });

    it('SettingsPage.jsx must have functional tabs, localStorage preferences, and Live Pattern Scanner', () => {
      const settingsContent = fs.readFileSync(path.join(clientSrc, 'pages', 'SettingsPage.jsx'), 'utf8');

      // Multi-tab navigation
      expect(settingsContent).toContain('activeTab');
      expect(settingsContent).toContain('Operator Profile & Preferences');
      expect(settingsContent).toContain('Detection Signatures & Simulator');
      expect(settingsContent).toContain('Diagnostics & Cloud');

      // LocalStorage persistence for user preferences
      expect(settingsContent).toContain('localStorage.setItem(\'leaklens_preferences\'');
      expect(settingsContent).toContain('handleSavePreferences');
      expect(settingsContent).toContain('handleResetPreferences');

      // Live Pattern Scanner & Masking Simulator
      expect(settingsContent).toContain('Interactive Pattern Scanner & Masking Simulator');
      expect(settingsContent).toContain('handleRunSimulator');
      expect(settingsContent).toContain('Simulate In-Memory Scan & Mask');
      expect(settingsContent).toContain('Masked Output');

      // Cloud Diagnostics Ping
      expect(settingsContent).toContain('Execute Live Diagnostics Ping');
      expect(settingsContent).toContain('handlePingDiagnostics');
    });
  });

  describe('8. Shared Component Resilience', () => {
    it('EmptyState.jsx must support actionText or actionLabel and description or message', () => {
      const emptyContent = fs.readFileSync(path.join(clientSrc, 'components', 'EmptyState.jsx'), 'utf8');

      expect(emptyContent).toContain('resolvedActionText = actionText || actionLabel');
      expect(emptyContent).toContain('resolvedDescription = description || message');
    });
  });
});
