import React, { useState } from 'react';
import StatusBadge from '../StatusBadge';
import {
  testSqlIntegration,
  testBlobIntegration,
  testKeyVaultIntegration,
  testPowerBiIntegration,
  updateIntegrationPreferences
} from '../../services/api';

const WIZARD_STEPS = [
  { step: 1, title: 'Azure Resource Info', subtitle: 'Cloud subscription & environment metadata' },
  { step: 2, title: 'Azure SQL Database', subtitle: 'Relational data store & schema' },
  { step: 3, title: 'Blob Storage', subtitle: 'Private volatile file ingestion' },
  { step: 4, title: 'Key Vault', subtitle: 'Managed secrets & encryption references' },
  { step: 5, title: 'Power BI', subtitle: 'Executive compliance reporting link' },
  { step: 6, title: 'Validate Connections', subtitle: 'Live connectivity test runner' },
  { step: 7, title: 'Review Configuration', subtitle: 'Classification of settings & next steps' },
  { step: 8, title: 'Finish', subtitle: 'Complete setup & save preferences' }
];

export function AzureSetupWizard({ currentMetadata, onClose, onComplete }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    // Step 1: Azure resource metadata
    subscriptionName: currentMetadata?.preferences?.azure_subscription_name || 'LeakLens-Production-Subscription',
    subscriptionId: '',
    resourceGroup: currentMetadata?.preferences?.azure_resource_group || 'rg-leaklens-eastus-001',
    region: currentMetadata?.preferences?.azure_region || 'eastus',
    appServiceName: currentMetadata?.integrations?.find(i => i.id === 'app-service')?.appName || 'leaklens-app-service',

    // Step 2: SQL
    sqlServer: currentMetadata?.integrations?.find(i => i.id === 'sql')?.serverName || 'leaklens-sql-server.database.windows.net',
    sqlDatabase: currentMetadata?.integrations?.find(i => i.id === 'sql')?.databaseName || 'LeakLensDB',
    sqlAuthMode: 'azure-active-directory-default',

    // Step 3: Blob Storage
    storageAccount: currentMetadata?.integrations?.find(i => i.id === 'blob')?.accountName || 'leaklensscansprod',
    storageContainer: 'leaklens-scans',

    // Step 4: Key Vault
    vaultName: currentMetadata?.integrations?.find(i => i.id === 'key-vault')?.vaultUri ? currentMetadata.integrations.find(i => i.id === 'key-vault').vaultUri.replace(/https:\/\/|\.vault\.azure\.net/g, '') : 'kv-leaklens-prod',
    secretReferences: 'SESSION-SECRET, DB-PASSWORD',

    // Step 5: Power BI
    pbiReportName: currentMetadata?.preferences?.power_bi_report_name || 'Executive Exposure Telemetry',
    pbiReportUrl: currentMetadata?.preferences?.power_bi_report_url || 'https://app.powerbi.com/groups/me/reports/leaklens-executive-summary'
  });

  const [stepError, setStepError] = useState(null);
  const [validating, setValidating] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [saving, setSaving] = useState(false);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setStepError(null);
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.resourceGroup.trim()) return 'Resource Group is required.';
        if (!formData.region.trim()) return 'Region is required.';
        return null;
      case 2:
        if (!formData.sqlServer.trim()) return 'SQL Server hostname is required.';
        if (!formData.sqlDatabase.trim()) return 'Database name is required.';
        if (formData.sqlServer.trim().toLowerCase() !== 'localhost' && !formData.sqlServer.toLowerCase().includes('.database.windows.net')) {
          return 'Azure SQL Server hostname must end with .database.windows.net';
        }
        return null;
      case 3:
        if (!formData.storageAccount.trim()) return 'Storage Account name is required.';
        if (!/^[a-z0-9]{3,24}$/.test(formData.storageAccount.trim())) {
          return 'Storage Account name must be 3-24 lowercase alphanumeric characters.';
        }
        return null;
      case 4:
        if (!formData.vaultName.trim()) return 'Key Vault name or URI is required.';
        return null;
      case 5:
        if (!formData.pbiReportUrl.trim()) return 'Power BI report URL is required.';
        try {
          const u = new URL(formData.pbiReportUrl.trim());
          if (u.protocol !== 'https:') return 'Power BI report URL must use HTTPS.';
          if (!u.hostname.endsWith('powerbi.com')) return 'URL must belong to official Power BI domain (*.powerbi.com).';
        } catch {
          return 'Invalid URL format.';
        }
        return null;
      default:
        return null;
    }
  };

  const handleNext = () => {
    const err = validateStep(currentStep);
    if (err) {
      setStepError(err);
      return;
    }
    setStepError(null);
    setCurrentStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStepError(null);
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const runAllTests = async () => {
    setValidating(true);
    const results = {};

    try {
      // 1. SQL Test
      try {
        const res = await testSqlIntegration();
        results.sql = res.data;
      } catch (e) {
        results.sql = { isConnected: false, status: 'CONNECTION_FAILED', message: e.message };
      }

      // 2. Blob Test
      try {
        const res = await testBlobIntegration();
        results.blob = res.data;
      } catch (e) {
        results.blob = { isConnected: false, status: 'CONNECTION_FAILED', message: e.message };
      }

      // 3. Key Vault Test
      try {
        const res = await testKeyVaultIntegration();
        results.keyVault = res.data;
      } catch (e) {
        results.keyVault = { isConnected: false, status: 'CONNECTION_FAILED', message: e.message };
      }

      // 4. Power BI Test
      try {
        const res = await testPowerBiIntegration(formData.pbiReportUrl);
        results.powerBi = res.data;
      } catch (e) {
        results.powerBi = { isConnected: false, status: 'CONNECTION_FAILED', message: e.message };
      }

      setTestResults(results);
    } finally {
      setValidating(false);
    }
  };

  const handleFinish = async () => {
    try {
      setSaving(true);
      await updateIntegrationPreferences({
        power_bi_report_name: formData.pbiReportName,
        power_bi_report_url: formData.pbiReportUrl,
        azure_subscription_name: formData.subscriptionName,
        azure_resource_group: formData.resourceGroup,
        azure_region: formData.region
      });
      if (onComplete) onComplete();
      onClose();
    } catch (err) {
      setStepError(err.message || 'Failed to save preferences.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.70)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="panel"
        style={{
          width: '100%',
          maxWidth: '860px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-glass-lg)',
          overflow: 'hidden'
        }}
      >
        {/* Wizard Header & Progress Bar */}
        <div style={{ padding: '24px 28px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-app)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--accent-cyan)', fontWeight: 700 }}>
                Stage {currentStep} of {WIZARD_STEPS.length}
              </span>
              <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {WIZARD_STEPS[currentStep - 1].title}
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {WIZARD_STEPS[currentStep - 1].subtitle}
              </p>
            </div>
            <button className="btn btn-secondary" onClick={onClose} style={{ padding: '4px 10px', fontSize: '12px' }}>
              ✕ Exit Wizard
            </button>
          </div>

          {/* Stepper Dots */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '16px' }}>
            {WIZARD_STEPS.map((s) => (
              <div
                key={s.step}
                style={{
                  flex: 1,
                  height: '5px',
                  borderRadius: '3px',
                  backgroundColor: s.step === currentStep ? 'var(--accent-cyan)' : s.step < currentStep ? 'var(--status-healthy)' : 'var(--border-subtle)',
                  transition: 'background-color 0.25s ease'
                }}
                title={`Stage ${s.step}: ${s.title}`}
              />
            ))}
          </div>
        </div>

        {/* Wizard Body (Scrollable) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {stepError && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '18px',
              fontSize: '13px',
              backgroundColor: 'var(--status-danger-bg)',
              color: 'var(--status-danger)',
              border: '1px solid var(--status-danger)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>⚠️</span>
              <span>{stepError}</span>
            </div>
          )}

          {/* STAGE 1: Azure Resource Information */}
          {currentStep === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(2, 132, 199, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2, 132, 199, 0.2)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                ℹ️ <strong>Scope Note:</strong> These metadata fields provide documentation context for your team. Entering values here does <em>not</em> grant broad subscription management permissions to LeakLens.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Azure Subscription Display Name
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  value={formData.subscriptionName}
                  onChange={(e) => handleInputChange('subscriptionName', e.target.value)}
                  placeholder="e.g. Enterprise Production Subscription"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Resource Group *
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    value={formData.resourceGroup}
                    onChange={(e) => handleInputChange('resourceGroup', e.target.value)}
                    placeholder="e.g. rg-leaklens-prod"
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Azure Region *
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    value={formData.region}
                    onChange={(e) => handleInputChange('region', e.target.value)}
                    placeholder="e.g. eastus or westeurope"
                    required
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Target App Service Name
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  value={formData.appServiceName}
                  onChange={(e) => handleInputChange('appServiceName', e.target.value)}
                  placeholder="e.g. app-leaklens-prod"
                />
              </div>
            </div>
          )}

          {/* STAGE 2: Azure SQL Configuration */}
          {currentStep === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(2, 132, 199, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2, 132, 199, 0.2)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                🔐 <strong>Managed Identity Recommended:</strong> LeakLens uses Microsoft Entra token authentication in production. Passwords and credentials never persist in frontend code or storage.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  SQL Server Hostname *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  value={formData.sqlServer}
                  onChange={(e) => handleInputChange('sqlServer', e.target.value)}
                  placeholder="server-name.database.windows.net"
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Must end with <code>.database.windows.net</code>.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Database Name *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  value={formData.sqlDatabase}
                  onChange={(e) => handleInputChange('sqlDatabase', e.target.value)}
                  placeholder="LeakLensDB"
                  required
                />
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Azure Portal Firewall Requirement:</strong>
                Ensure <em>"Allow Azure services and resources to access this server"</em> is toggled to <strong>Yes</strong> under Azure SQL Server Networking.
              </div>
            </div>
          )}

          {/* STAGE 3: Blob Storage Configuration */}
          {currentStep === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(2, 132, 199, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2, 132, 199, 0.2)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                🛡️ <strong>Zero Anonymous Access:</strong> The scan container is strictly private. Anonymous read access is explicitly disabled to prevent data leakage.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Storage Account Name *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  value={formData.storageAccount}
                  onChange={(e) => handleInputChange('storageAccount', e.target.value.toLowerCase())}
                  placeholder="e.g. leaklensscansprod"
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  3-24 lowercase letters and numbers. Endpoint: <code>https://{formData.storageAccount || '<account>'}.blob.core.windows.net</code>
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Target Scan Container Name
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  value={formData.storageContainer}
                  onChange={(e) => handleInputChange('storageContainer', e.target.value.toLowerCase())}
                  disabled
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Default is <code>leaklens-scans</code> with opaque UUID object prefixing.
                </span>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Required Azure Role:</strong>
                Assign <strong>Storage Blob Data Contributor</strong> to your App Service Managed Identity under Storage Account IAM.
              </div>
            </div>
          )}

          {/* STAGE 4: Key Vault Configuration */}
          {currentStep === 4 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(2, 132, 199, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2, 132, 199, 0.2)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                🔑 <strong>Centralized Secrets Management:</strong> The application queries secrets at startup and caches them in volatile memory. No secrets are stored in source control or database tables.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Key Vault Name *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  value={formData.vaultName}
                  onChange={(e) => handleInputChange('vaultName', e.target.value)}
                  placeholder="e.g. kv-leaklens-prod"
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Vault URI: <code>https://{formData.vaultName || '<vault>'}.vault.azure.net</code>
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Required Secret References
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px', opacity: 0.8 }}
                  value={formData.secretReferences}
                  disabled
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Ensure <code>SESSION-SECRET</code> and <code>DB-PASSWORD</code> (if not using Entra MSI) exist in the vault.
                </span>
              </div>

              <div style={{ padding: '12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                <strong style={{ display: 'block', marginBottom: '4px' }}>Required Azure Role:</strong>
                Assign <strong>Key Vault Secrets User</strong> to the App Service Managed Identity under Key Vault Access Control (IAM).
              </div>
            </div>
          )}

          {/* STAGE 5: Power BI Configuration */}
          {currentStep === 5 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(2, 132, 199, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2, 132, 199, 0.2)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                📊 <strong>SSRF Protection Enforced:</strong> LeakLens validates Power BI report links against the Microsoft Power BI service allowlist (<code>*.powerbi.com</code>) to prevent server-side request forgery.
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Report Display Name
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  value={formData.pbiReportName}
                  onChange={(e) => handleInputChange('pbiReportName', e.target.value)}
                  placeholder="e.g. Executive Exposure Telemetry"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Power BI Report URL *
                </label>
                <input
                  type="url"
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  value={formData.pbiReportUrl}
                  onChange={(e) => handleInputChange('pbiReportUrl', e.target.value)}
                  placeholder="https://app.powerbi.com/groups/me/reports/..."
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                  Must start with <code>https://app.powerbi.com</code> or <code>*.powerbi.com</code>.
                </span>
              </div>
            </div>
          )}

          {/* STAGE 6: Validate Connections */}
          {currentStep === 6 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    Live Connectivity Test Runner
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Executes actual backend connection checks against your configured services.
                  </p>
                </div>
                <button
                  className="btn btn-primary"
                  onClick={runAllTests}
                  disabled={validating}
                  style={{ fontSize: '12px', padding: '6px 16px' }}
                >
                  {validating ? 'Running Tests...' : '⚡ Test All Integrations'}
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* SQL Result */}
                <div style={{ padding: '12px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Azure SQL Database</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {testResults.sql?.message || 'Awaiting test execution'}
                    </div>
                  </div>
                  <StatusBadge type={testResults.sql?.isConnected ? 'healthy' : testResults.sql ? 'danger' : 'info'}>
                    {testResults.sql ? (testResults.sql.isConnected ? 'CONNECTED' : 'FAILED') : 'PENDING'}
                  </StatusBadge>
                </div>

                {/* Blob Result */}
                <div style={{ padding: '12px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Azure Blob Storage</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {testResults.blob?.message || 'Awaiting test execution'}
                    </div>
                  </div>
                  <StatusBadge type={testResults.blob?.isConnected ? 'healthy' : testResults.blob ? 'danger' : 'info'}>
                    {testResults.blob ? (testResults.blob.isConnected ? 'CONNECTED' : 'FAILED') : 'PENDING'}
                  </StatusBadge>
                </div>

                {/* Key Vault Result */}
                <div style={{ padding: '12px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Azure Key Vault</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {testResults.keyVault?.message || 'Awaiting test execution'}
                    </div>
                  </div>
                  <StatusBadge type={testResults.keyVault?.isConnected ? 'healthy' : testResults.keyVault ? 'danger' : 'info'}>
                    {testResults.keyVault ? (testResults.keyVault.isConnected ? 'CONNECTED' : 'FAILED') : 'PENDING'}
                  </StatusBadge>
                </div>

                {/* Power BI Result */}
                <div style={{ padding: '12px 16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong>Power BI Report Link</strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {testResults.powerBi?.message || 'Awaiting test execution'}
                    </div>
                  </div>
                  <StatusBadge type={testResults.powerBi?.isConnected ? 'healthy' : testResults.powerBi ? 'danger' : 'info'}>
                    {testResults.powerBi ? (testResults.powerBi.isConnected ? 'VERIFIED' : 'FAILED') : 'PENDING'}
                  </StatusBadge>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 7: Review Configuration */}
          {currentStep === 7 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px 16px', background: 'rgba(2, 132, 199, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2, 132, 199, 0.2)', fontSize: '12px' }}>
                📋 <strong>Configuration Classification:</strong> The Settings UI persists application preferences only. Server-side secrets and connection endpoints are applied through Azure App Service Configuration.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '14px', fontSize: '12px' }}>
                {/* Public Identifiers */}
                <div style={{ padding: '14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                    1. Public Resource Identifiers
                  </strong>
                  <ul style={{ paddingLeft: '16px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    <li>SQL Server: <code>{formData.sqlServer}</code></li>
                    <li>Database: <code>{formData.sqlDatabase}</code></li>
                    <li>Storage Account: <code>{formData.storageAccount}</code></li>
                    <li>Key Vault: <code>https://{formData.vaultName}.vault.azure.net</code></li>
                  </ul>
                </div>

                {/* Non-secret Settings */}
                <div style={{ padding: '14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                    2. Non-Secret Application Preferences
                  </strong>
                  <ul style={{ paddingLeft: '16px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    <li>Power BI Link: <code style={{ wordBreak: 'break-all' }}>{formData.pbiReportUrl}</code></li>
                    <li>Resource Group: <code>{formData.resourceGroup}</code></li>
                    <li>Region: <code>{formData.region}</code></li>
                  </ul>
                </div>

                {/* Azure Portal Permissions */}
                <div style={{ padding: '14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                    3. Required Azure Portal Roles
                  </strong>
                  <ul style={{ paddingLeft: '16px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    <li>Storage: <code>Storage Blob Data Contributor</code></li>
                    <li>Key Vault: <code>Key Vault Secrets User</code></li>
                    <li>SQL: External Provider User with <code>db_datareader/writer</code></li>
                  </ul>
                </div>

                {/* Restart Triggers */}
                <div style={{ padding: '14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>
                    4. App Service Restart Triggers
                  </strong>
                  <ul style={{ paddingLeft: '16px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                    <li>Updating <code>DB_SERVER</code> or <code>DB_NAME</code></li>
                    <li>Updating <code>AZURE_STORAGE_ACCOUNT_NAME</code></li>
                    <li>Updating Key Vault secret references</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* STAGE 8: Finish */}
          {currentStep === 8 && (
            <div style={{ textAlign: 'center', padding: '20px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '50%', backgroundColor: 'var(--status-healthy-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', color: 'var(--status-healthy)' }}>
                ✓
              </div>
              <h3 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Azure Integrations Setup Ready
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '540px', lineHeight: 1.6 }}>
                You have reviewed and validated your cloud integration parameters. Clicking <strong>Save Preferences</strong> will persist non-secret documentation metadata and report URLs.
              </p>
              <div style={{ padding: '12px 18px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', fontSize: '12px', textAlign: 'left', maxWidth: '520px' }}>
                <strong>Reminder:</strong> To activate new SQL or Blob endpoints, ensure your team sets the matching environment variables in Azure App Service Configuration and performs an application restart.
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-app)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            {currentStep > 1 && (
              <button
                className="btn btn-secondary"
                onClick={handleBack}
                disabled={saving || validating}
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                ← Back
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {currentStep < 8 ? (
              <button
                className="btn btn-primary"
                onClick={handleNext}
                disabled={validating}
                style={{ fontSize: '12px', padding: '6px 18px' }}
              >
                {currentStep === 6 ? 'Review Settings →' : 'Continue →'}
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleFinish}
                disabled={saving}
                style={{ fontSize: '12px', padding: '6px 20px' }}
              >
                {saving ? 'Saving Preferences...' : 'Save Preferences & Exit'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AzureSetupWizard;
