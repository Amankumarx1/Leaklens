import React, { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../StatusBadge';
import AzureSetupGuideModal from './AzureSetupGuideModal';
import AzureServiceDetailModal from './AzureServiceDetailModal';
import AzureSetupWizard from './AzureSetupWizard';
import {
  getIntegrations,
  testSqlIntegration,
  testBlobIntegration,
  testKeyVaultIntegration,
  testPowerBiIntegration,
  testAllIntegrations,
  updateIntegrationPreferences,
  authorizeSqlIntegration,
  assignBlobRoleIntegration,
  assignKeyVaultRoleIntegration,
  restartAppServiceIntegration
} from '../../services/api';

export function AzureIntegrationsView({ user, onNavigateToDiagnostics }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [selectedServiceDetail, setSelectedServiceDetail] = useState(null);

  // Accordion toggles for advanced options
  const [expandSqlAdvanced, setExpandSqlAdvanced] = useState(false);
  const [expandBlobAdvanced, setExpandBlobAdvanced] = useState(false);
  const [expandVaultAdvanced, setExpandVaultAdvanced] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // In-flight testing and execution states
  const [testingServiceId, setTestingServiceId] = useState(null);
  const [testingAll, setTestingAll] = useState(false);
  const [savingAll, setSavingAll] = useState(false);
  const [executingSqlAuth, setExecutingSqlAuth] = useState(false);
  const [executingBlobRole, setExecutingBlobRole] = useState(false);
  const [executingKeyVaultRole, setExecutingKeyVaultRole] = useState(false);
  const [executingRestart, setExecutingRestart] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);
  const [copyStatus, setCopyStatus] = useState(null);

  // Live in-platform diagnostic audit log
  const [actionLogs, setActionLogs] = useState([
    {
      timestamp: new Date().toLocaleTimeString(),
      type: 'info',
      message: 'Azure Connection Manager initialized. Configure endpoints and test connectivity directly in-platform.'
    }
  ]);

  // Configuration States
  const [appServiceName, setAppServiceName] = useState('');
  const [managedIdentityEnabled, setManagedIdentityEnabled] = useState(false);
  const [principalId, setPrincipalId] = useState('');
  const [azureSubscription, setAzureSubscription] = useState('');
  const [azureResourceGroup, setAzureResourceGroup] = useState('');
  const [azureRegion, setAzureRegion] = useState('');

  // SQL Credentials
  const [sqlServer, setSqlServer] = useState('');
  const [sqlDatabase, setSqlDatabase] = useState('');
  const [sqlPort, setSqlPort] = useState(1433);
  const [sqlAuthType, setSqlAuthType] = useState('azure-active-directory-default');
  const [sqlAdminUser, setSqlAdminUser] = useState('');
  const [sqlAdminPassword, setSqlAdminPassword] = useState('');
  const [showSqlPassword, setShowSqlPassword] = useState(false);
  const [sqlNetworkingAllowed, setSqlNetworkingAllowed] = useState(false);
  const [sqlRoleAuthorized, setSqlRoleAuthorized] = useState(false);

  // Storage Credentials
  const [storageAccountName, setStorageAccountName] = useState('');
  const [storageContainerName, setStorageContainerName] = useState('');
  const [storageAccessKey, setStorageAccessKey] = useState('');
  const [showStorageKey, setShowStorageKey] = useState(false);
  const [blobRoleAssigned, setBlobRoleAssigned] = useState(false);

  // Key Vault Credentials
  const [keyVaultUri, setKeyVaultUri] = useState('');
  const [keyvaultRoleAssigned, setKeyvaultRoleAssigned] = useState(false);
  const [keyVaultClientId, setKeyVaultClientId] = useState('');
  const [keyVaultClientSecret, setKeyVaultClientSecret] = useState('');
  const [showVaultSecret, setShowVaultSecret] = useState(false);

  // Power BI
  const [pbiName, setPbiName] = useState('');
  const [pbiUrl, setPbiUrl] = useState('');

  const addLog = (type, message) => {
    setActionLogs(prev => [
      { timestamp: new Date().toLocaleTimeString(), type, message },
      ...prev.slice(0, 24)
    ]);
  };

  const syncFormFromData = useCallback((serverData) => {
    if (!serverData) return;
    const prefs = serverData.preferences || {};
    const sqlItem = serverData.integrations?.find(i => i.id === 'sql');
    const blobItem = serverData.integrations?.find(i => i.id === 'blob');
    const vaultItem = serverData.integrations?.find(i => i.id === 'key-vault');
    const appItem = serverData.integrations?.find(i => i.id === 'app-service');

    if (prefs.app_service_name || (appItem?.appName && appItem.appName !== 'None')) {
      setAppServiceName(prefs.app_service_name || appItem.appName);
    }
    if (prefs.managed_identity_enabled !== undefined) {
      setManagedIdentityEnabled(!!prefs.managed_identity_enabled);
    }
    if (prefs.azure_subscription_name) setAzureSubscription(prefs.azure_subscription_name);
    if (prefs.azure_resource_group) setAzureResourceGroup(prefs.azure_resource_group);
    if (prefs.azure_region) setAzureRegion(prefs.azure_region);

    if (prefs.sql_server || (sqlItem?.serverName && sqlItem.serverName !== 'None')) {
      setSqlServer(prefs.sql_server || sqlItem.serverName);
    }
    if (prefs.sql_database || (sqlItem?.databaseName && sqlItem.databaseName !== 'None')) {
      setSqlDatabase(prefs.sql_database || sqlItem.databaseName);
    }
    if (prefs.sql_auth_type) setSqlAuthType(prefs.sql_auth_type);
    if (prefs.sql_port) setSqlPort(Number(prefs.sql_port) || 1433);
    if (prefs.sql_role_authorized !== undefined) setSqlRoleAuthorized(!!prefs.sql_role_authorized);
    if (prefs.sql_networking_allowed !== undefined) setSqlNetworkingAllowed(!!prefs.sql_networking_allowed);

    if (prefs.storage_account_name || (blobItem?.accountName && blobItem.accountName !== 'None')) {
      setStorageAccountName(prefs.storage_account_name || blobItem.accountName);
    }
    if (prefs.storage_container_name || (blobItem?.containerName && blobItem.containerName !== 'None')) {
      setStorageContainerName(prefs.storage_container_name || blobItem.containerName);
    }
    if (prefs.blob_role_assigned !== undefined) setBlobRoleAssigned(!!prefs.blob_role_assigned);

    if (prefs.key_vault_uri || (vaultItem?.vaultUri && vaultItem.vaultUri !== 'None')) {
      setKeyVaultUri(prefs.key_vault_uri || vaultItem.vaultUri);
    }
    if (prefs.keyvault_role_assigned !== undefined) setKeyvaultRoleAssigned(!!prefs.keyvault_role_assigned);

    if (prefs.power_bi_report_name) setPbiName(prefs.power_bi_report_name);
    if (prefs.power_bi_report_url) setPbiUrl(prefs.power_bi_report_url);
  }, []);

  const fetchIntegrationsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getIntegrations();
      if (res?.data) {
        setData(res.data);
        syncFormFromData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load Azure integration metadata.');
    } finally {
      setLoading(false);
    }
  }, [syncFormFromData]);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await getIntegrations();
        if (!ignore && res?.data) {
          setData(res.data);
          syncFormFromData(res.data);
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load Azure integration metadata.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, [syncFormFromData]);

  const handleTestService = async (serviceId) => {
    try {
      setTestingServiceId(serviceId);
      setTestFeedback(null);
      let res;
      if (serviceId === 'sql') {
        res = await testSqlIntegration({
          sqlServer,
          sqlDatabase,
          sqlAuthType,
          sqlAdminUser,
          sqlAdminPassword
        });
      } else if (serviceId === 'blob') {
        res = await testBlobIntegration({
          storageAccountName,
          storageContainerName,
          storageAccessKey
        });
      } else if (serviceId === 'key-vault') {
        res = await testKeyVaultIntegration({
          keyVaultUri,
          clientId: keyVaultClientId,
          clientSecret: keyVaultClientSecret
        });
      } else if (serviceId === 'power-bi') {
        res = await testPowerBiIntegration(pbiUrl);
      }

      if (res?.data) {
        const isConn = res.data.isConnected;
        setTestFeedback({
          serviceId,
          type: isConn ? 'success' : 'error',
          message: res.data.message || (isConn ? 'Connected successfully.' : 'Connection check failed.')
        });
        addLog(isConn ? 'success' : 'error', `[${serviceId.toUpperCase()}] ${res.data.message}`);
        await fetchIntegrationsData();
      }
    } catch (err) {
      setTestFeedback({
        serviceId,
        type: 'error',
        message: err.message || `Failed to test ${serviceId}.`
      });
      addLog('error', `[${serviceId.toUpperCase()}] Check failed: ${err.message}`);
    } finally {
      setTestingServiceId(null);
    }
  };

  const handleTestAll = async () => {
    try {
      setTestingAll(true);
      setTestFeedback(null);
      addLog('info', 'Executing comprehensive parallel connectivity test across all Azure services...');
      const res = await testAllIntegrations();
      if (res?.data) {
        const results = res.data.results || {};
        const passedCount = Object.values(results).filter(r => r?.isConnected).length;
        setTestFeedback({
          serviceId: 'all',
          type: passedCount === 4 ? 'success' : 'warning',
          message: `Verification complete: ${passedCount} of 4 services successfully responded.`
        });
        addLog('success', `Parallel test finished: ${passedCount}/4 services online.`);
        await fetchIntegrationsData();
      }
    } catch (err) {
      setTestFeedback({
        serviceId: 'all',
        type: 'error',
        message: err.message || 'Failed to complete cloud service connectivity test.'
      });
      addLog('error', `Parallel test execution failed: ${err.message}`);
    } finally {
      setTestingAll(false);
    }
  };

  const handleSaveAll = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      setSavingAll(true);
      setTestFeedback(null);
      const payload = {
        app_service_name: appServiceName.trim(),
        managed_identity_enabled: managedIdentityEnabled,
        azure_subscription_name: azureSubscription.trim(),
        azure_resource_group: azureResourceGroup.trim(),
        azure_region: azureRegion.trim(),
        sql_server: sqlServer.trim(),
        sql_database: sqlDatabase.trim(),
        sql_port: Number(sqlPort) || 1433,
        sql_auth_type: sqlAuthType,
        sql_admin_username: sqlAdminUser.trim(),
        sql_admin_password: sqlAdminPassword,
        sql_networking_allowed: sqlNetworkingAllowed,
        sql_role_authorized: sqlRoleAuthorized,
        storage_account_name: storageAccountName.trim(),
        storage_container_name: storageContainerName.trim(),
        storage_access_key: storageAccessKey.trim(),
        blob_role_assigned: blobRoleAssigned,
        key_vault_uri: keyVaultUri.trim(),
        key_vault_client_id: keyVaultClientId.trim(),
        key_vault_client_secret: keyVaultClientSecret,
        keyvault_role_assigned: keyvaultRoleAssigned,
        power_bi_report_name: pbiName.trim(),
        power_bi_report_url: pbiUrl.trim()
      };

      await updateIntegrationPreferences(payload);
      setTestFeedback({
        serviceId: 'all',
        type: 'success',
        message: 'All Azure configuration parameters saved and persisted to runtime.'
      });
      addLog('success', 'Configuration successfully saved and applied to runtime environment.');
      await fetchIntegrationsData();
    } catch (err) {
      setTestFeedback({
        serviceId: 'all',
        type: 'error',
        message: err.message || 'Failed to save configuration.'
      });
      addLog('error', `Failed to persist configuration: ${err.message}`);
    } finally {
      setSavingAll(false);
    }
  };

  const handleClearForm = () => {
    setAppServiceName('');
    setManagedIdentityEnabled(false);
    setPrincipalId('');
    setAzureSubscription('');
    setAzureResourceGroup('');
    setAzureRegion('');
    setSqlServer('');
    setSqlDatabase('');
    setSqlPort(1433);
    setSqlAuthType('azure-active-directory-default');
    setSqlAdminUser('');
    setSqlAdminPassword('');
    setSqlNetworkingAllowed(false);
    setSqlRoleAuthorized(false);
    setStorageAccountName('');
    setStorageContainerName('');
    setStorageAccessKey('');
    setBlobRoleAssigned(false);
    setKeyVaultUri('');
    setKeyvaultRoleAssigned(false);
    setKeyVaultClientId('');
    setKeyVaultClientSecret('');
    setPbiName('');
    setPbiUrl('');
    setTestFeedback({
      serviceId: 'all',
      type: 'warning',
      message: 'All form fields cleared. Ready for your live production credentials.'
    });
    addLog('info', 'Configuration form cleared.');
  };

  const handleExecuteSqlAuthorization = async () => {
    try {
      setExecutingSqlAuth(true);
      const res = await authorizeSqlIntegration({ appServiceName });
      setSqlRoleAuthorized(true);
      setTestFeedback({
        serviceId: 'sql',
        type: 'success',
        message: res.data?.message || 'External Provider user created and roles granted.'
      });
      addLog('success', `[SQL] Authorization script executed for [${appServiceName.trim() || '<app-service-name>'}]. Roles granted: db_datareader, db_datawriter.`);
      await fetchIntegrationsData();
    } catch (err) {
      setTestFeedback({
        serviceId: 'sql',
        type: 'error',
        message: err.message || 'Failed to execute SQL authorization.'
      });
      addLog('error', `[SQL] Authorization execution failed: ${err.message}`);
    } finally {
      setExecutingSqlAuth(false);
    }
  };

  const handleAssignBlobRole = async () => {
    try {
      setExecutingBlobRole(true);
      const res = await assignBlobRoleIntegration({ appServiceName, storageAccountName, storageContainerName });
      setBlobRoleAssigned(true);
      setTestFeedback({
        serviceId: 'blob',
        type: 'success',
        message: res.data?.message || 'Storage Blob Data Contributor role assigned.'
      });
      addLog('success', `[Blob Storage] Storage Blob Data Contributor role assigned to Managed Identity [${appServiceName.trim() || '<app-service-name>'}].`);
      await fetchIntegrationsData();
    } catch (err) {
      setTestFeedback({
        serviceId: 'blob',
        type: 'error',
        message: err.message || 'Failed to assign Blob Storage role.'
      });
      addLog('error', `[Blob Storage] Role assignment failed: ${err.message}`);
    } finally {
      setExecutingBlobRole(false);
    }
  };

  const handleAssignKeyVaultRole = async () => {
    try {
      setExecutingKeyVaultRole(true);
      const res = await assignKeyVaultRoleIntegration({ appServiceName, keyVaultUri });
      setKeyvaultRoleAssigned(true);
      setTestFeedback({
        serviceId: 'key-vault',
        type: 'success',
        message: res.data?.message || 'Key Vault Secrets User role assigned.'
      });
      addLog('success', `[Key Vault] Key Vault Secrets User role assigned to Managed Identity [${appServiceName.trim() || '<app-service-name>'}].`);
      await fetchIntegrationsData();
    } catch (err) {
      setTestFeedback({
        serviceId: 'key-vault',
        type: 'error',
        message: err.message || 'Failed to assign Key Vault role.'
      });
      addLog('error', `[Key Vault] Role assignment failed: ${err.message}`);
    } finally {
      setExecutingKeyVaultRole(false);
    }
  };

  const handleRestartAppService = async () => {
    try {
      setExecutingRestart(true);
      await restartAppServiceIntegration({
        appServiceName,
        sqlServer,
        sqlDatabase,
        sqlAuthType,
        storageAccountName,
        keyVaultUri
      });
      setTestFeedback({
        serviceId: 'app-service',
        type: 'success',
        message: 'Runtime environment variables reloaded and synchronized.'
      });
      addLog('success', 'Runtime restarted. Fresh cloud environment applied.');
      await fetchIntegrationsData();
    } catch (err) {
      setTestFeedback({
        serviceId: 'app-service',
        type: 'error',
        message: err.message || 'Failed to reload runtime.'
      });
      addLog('error', `Runtime reload error: ${err.message}`);
    } finally {
      setExecutingRestart(false);
    }
  };

  const targetApp = appServiceName.trim() || '<app-service-name>';
  const generatedSqlScript = `CREATE USER [${targetApp}] FROM EXTERNAL PROVIDER;\nALTER ROLE db_datareader ADD MEMBER [${targetApp}];\nALTER ROLE db_datawriter ADD MEMBER [${targetApp}];\nGRANT EXECUTE ON SCHEMA::leaklens TO [${targetApp}];`;

  const handleCopySqlScript = () => {
    navigator.clipboard.writeText(generatedSqlScript).then(() => {
      setCopyStatus(`T-SQL script for [${targetApp}] copied.`);
      setTimeout(() => setCopyStatus(null), 3000);
    });
  };

  const getServiceStatus = (id) => {
    return data?.integrations?.find(i => i.id === id) || null;
  };

  if (loading && !data) {
    return (
      <div className="state-center" style={{ minHeight: '340px' }}>
        <div className="spinner" />
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '12px' }}>
          Loading Azure Integration Statuses...
        </p>
      </div>
    );
  }

  const sqlService = getServiceStatus('sql');
  const blobService = getServiceStatus('blob');
  const vaultService = getServiceStatus('key-vault');
  const pbiService = getServiceStatus('power-bi');
  const appService = getServiceStatus('app-service');

  const connectedCount = data?.overview?.connectedCount || 0;
  const totalCount = data?.overview?.totalServices || 5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Modals */}
      {showGuideModal && <AzureSetupGuideModal onClose={() => setShowGuideModal(false)} />}
      {showWizardModal && (
        <AzureSetupWizard
          onClose={() => setShowWizardModal(false)}
          onComplete={() => {
            setShowWizardModal(false);
            fetchIntegrationsData();
          }}
        />
      )}
      {selectedServiceDetail && (
        <AzureServiceDetailModal
          service={selectedServiceDetail}
          onClose={() => setSelectedServiceDetail(null)}
          onTest={handleTestService}
          isTesting={testingServiceId === selectedServiceDetail.id}
        />
      )}

      {/* Top Header & Action Bar */}
      <div className="panel" style={{ padding: '20px 24px', background: '#ffffff', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '24px' }}>☁️</span>
              <div>
                <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Azure Cloud Connection Manager
                </h2>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '2px 0 0 0' }}>
                  Configure, validate, and monitor LeakLens integrations with Azure SQL, Blob Storage, Key Vault, and Power BI.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              id="btn-test-all-integrations"
              className="btn btn-primary"
              onClick={handleTestAll}
              disabled={testingAll || savingAll}
              style={{ fontSize: '12px', padding: '8px 16px', fontWeight: 700 }}
              title="Execute connectivity verification across all 4 cloud services"
            >
              {testingAll ? 'Testing All...' : '⚡ Test All Services'}
            </button>

            <button
              id="btn-save-deploy-runtime"
              className="btn btn-secondary"
              onClick={handleSaveAll}
              disabled={savingAll || testingAll}
              style={{ fontSize: '12px', padding: '8px 16px', background: 'var(--accent-cyan)', color: '#0f172a', border: 'none', fontWeight: 700 }}
              title="Save non-secret preferences to runtime configuration"
            >
              {savingAll ? 'Saving...' : '💾 Save Settings'}
            </button>

            <button
              id="btn-clear-credentials"
              className="btn btn-secondary"
              onClick={handleClearForm}
              style={{ fontSize: '12px', padding: '8px 14px' }}
              title="Clear all form fields"
            >
              🗑️ Clear
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setShowWizardModal(true)}
              style={{ fontSize: '12px', padding: '8px 14px' }}
              title="Open step-by-step setup wizard"
            >
              🧙 Guided Wizard
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setShowGuideModal(true)}
              style={{ fontSize: '12px', padding: '8px 14px' }}
              title="View Azure architecture guide and T-SQL scripts"
            >
              📖 Cloud Docs
            </button>
          </div>
        </div>

        {/* Live Status Pills Row */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Status:
          </span>

          <div
            onClick={() => setSelectedServiceDetail(sqlService)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: '12px' }}
          >
            <span>🗄️ Azure SQL:</span>
            <StatusBadge type={sqlService?.status === 'CONNECTED' ? 'healthy' : sqlService?.status === 'DEGRADED' ? 'warning' : 'danger'}>
              {sqlService?.status || 'NOT CONFIGURED'}
            </StatusBadge>
          </div>

          <div
            onClick={() => setSelectedServiceDetail(blobService)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: '12px' }}
          >
            <span>🪣 Blob Storage:</span>
            <StatusBadge type={blobService?.status === 'CONNECTED' ? 'healthy' : blobService?.status === 'DEGRADED' ? 'warning' : 'danger'}>
              {blobService?.status || 'NOT CONFIGURED'}
            </StatusBadge>
          </div>

          <div
            onClick={() => setSelectedServiceDetail(vaultService)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: '12px' }}
          >
            <span>🔐 Key Vault:</span>
            <StatusBadge type={vaultService?.status === 'CONNECTED' ? 'healthy' : vaultService?.status === 'DEGRADED' ? 'warning' : 'danger'}>
              {vaultService?.status || 'NOT CONFIGURED'}
            </StatusBadge>
          </div>

          <div
            onClick={() => setSelectedServiceDetail(pbiService)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: '12px' }}
          >
            <span>📊 Power BI:</span>
            <StatusBadge type={pbiService?.status === 'CONNECTED' ? 'healthy' : pbiService?.status === 'DEGRADED' ? 'warning' : 'danger'}>
              {pbiService?.status || 'NOT CONFIGURED'}
            </StatusBadge>
          </div>

          <div
            onClick={() => setSelectedServiceDetail(appService)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', cursor: 'pointer', fontSize: '12px' }}
          >
            <span>☁️ App Service:</span>
            <StatusBadge type={appService?.status === 'CONNECTED' ? 'healthy' : 'warning'}>
              {appService?.status || 'DEGRADED'}
            </StatusBadge>
          </div>

          <div style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 700, color: connectedCount >= 4 ? 'var(--status-healthy)' : 'var(--text-secondary)' }}>
            {connectedCount} of {totalCount} Services Connected
          </div>
        </div>
      </div>

      {/* Global Feedback Banner */}
      {testFeedback && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          backgroundColor: testFeedback.type === 'success' ? 'var(--status-healthy-bg)' : testFeedback.type === 'warning' ? '#fef3c7' : 'var(--status-danger-bg)',
          color: testFeedback.type === 'success' ? 'var(--status-healthy)' : testFeedback.type === 'warning' ? '#b45309' : 'var(--status-danger)',
          border: `1px solid ${testFeedback.type === 'success' ? 'var(--status-healthy)' : testFeedback.type === 'warning' ? '#f59e0b' : 'var(--status-danger)'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <strong>{testFeedback.serviceId?.toUpperCase()}:</strong> {testFeedback.message}
          </div>
          <button
            onClick={() => setTestFeedback(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      )}

      {copyStatus && (
        <div style={{
          padding: '8px 14px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          backgroundColor: '#eff6ff',
          color: '#1d4ed8',
          border: '1px solid #bfdbfe'
        }}>
          {copyStatus}
        </div>
      )}

      {/* Simplified 2x2 Service Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        
        {/* CARD 1: Azure SQL Database */}
        <div className="panel" style={{ padding: '20px', background: '#ffffff', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🗄️</span>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Azure SQL Database
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Relational scan records, incidents & audit trail
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge type={sqlService?.status === 'CONNECTED' ? 'healthy' : 'danger'}>
                  {sqlService?.status || 'NOT CONFIGURED'}
                </StatusBadge>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleTestService('sql')}
                  disabled={testingServiceId === 'sql'}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  {testingServiceId === 'sql' ? 'Testing...' : '⚡ Test'}
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  Server Hostname (DB_SERVER)
                </label>
                <input
                  type="text"
                  className="input"
                  value={sqlServer}
                  onChange={(e) => setSqlServer(e.target.value)}
                  placeholder="e.g. your-db-server.database.windows.net"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  Database (DB_NAME)
                </label>
                <input
                  type="text"
                  className="input"
                  value={sqlDatabase}
                  onChange={(e) => setSqlDatabase(e.target.value)}
                  placeholder="e.g. your-database-name"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                Authentication Type
              </label>
              <select
                className="input"
                value={sqlAuthType}
                onChange={(e) => setSqlAuthType(e.target.value)}
                style={{ width: '100%', fontSize: '12px' }}
              >
                <option value="azure-active-directory-default">Microsoft Entra Managed Identity (Passwordless Recommended)</option>
                <option value="sql-auth">SQL Server Authentication (User & Password)</option>
              </select>
            </div>

            {/* Collapsible Advanced / Authorization Script */}
            <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => setExpandSqlAdvanced(!expandSqlAdvanced)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {expandSqlAdvanced ? '▾ Hide T-SQL Authorization & Advanced Options' : '▸ Show T-SQL Authorization Script & Permissions'}
              </button>

              {expandSqlAdvanced && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ background: '#0f172a', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'var(--font-mono)' }}>
                        -- T-SQL Authorization Script for [{targetApp}]
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={handleExecuteSqlAuthorization}
                          disabled={executingSqlAuth}
                          style={{ fontSize: '10px', padding: '2px 8px', background: 'var(--accent-cyan)', color: '#0f172a', border: 'none', borderRadius: '4px', fontWeight: 700, cursor: 'pointer' }}
                        >
                          {executingSqlAuth ? 'Running...' : 'Execute Now'}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopySqlScript}
                          style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(255,255,255,0.1)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <pre style={{ margin: 0, color: '#38bdf8', fontSize: '11px', fontFamily: 'var(--font-mono)', lineHeight: 1.4, overflowX: 'auto' }}>
                      {generatedSqlScript}
                    </pre>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sqlNetworkingAllowed}
                        onChange={(e) => setSqlNetworkingAllowed(e.target.checked)}
                      />
                      Allow Azure Services Access = Yes
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={sqlRoleAuthorized}
                        onChange={(e) => setSqlRoleAuthorized(e.target.checked)}
                      />
                      External Provider User Created
                    </label>
                  </div>

                  {sqlAuthType === 'sql-auth' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '8px', background: 'var(--bg-app)', borderRadius: '4px' }}>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Admin Username</label>
                        <input
                          type="text"
                          className="input"
                          value={sqlAdminUser}
                          onChange={(e) => setSqlAdminUser(e.target.value)}
                          placeholder="e.g. sqladmin"
                          style={{ width: '100%', fontSize: '11px' }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Admin Password</label>
                        <input
                          type={showSqlPassword ? 'text' : 'password'}
                          className="input"
                          value={sqlAdminPassword}
                          onChange={(e) => setSqlAdminPassword(e.target.value)}
                          placeholder="••••••••••••"
                          style={{ width: '100%', fontSize: '11px' }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            {sqlService?.lastResult || 'Awaiting connection test'}
          </div>
        </div>

        {/* CARD 2: Azure Blob Storage */}
        <div className="panel" style={{ padding: '20px', background: '#ffffff', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🪣</span>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Azure Blob Storage
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Quarantine file upload & scanning staging
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge type={blobService?.status === 'CONNECTED' ? 'healthy' : 'danger'}>
                  {blobService?.status || 'NOT CONFIGURED'}
                </StatusBadge>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleTestService('blob')}
                  disabled={testingServiceId === 'blob'}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  {testingServiceId === 'blob' ? 'Testing...' : '⚡ Test'}
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  Storage Account (AZURE_STORAGE_ACCOUNT_NAME)
                </label>
                <input
                  type="text"
                  className="input"
                  value={storageAccountName}
                  onChange={(e) => setStorageAccountName(e.target.value.toLowerCase())}
                  placeholder="e.g. yourstorageaccount"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  Scan Container (CONTAINER_NAME)
                </label>
                <input
                  type="text"
                  className="input"
                  value={storageContainerName}
                  onChange={(e) => setStorageContainerName(e.target.value.toLowerCase())}
                  placeholder="e.g. scans"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                />
              </div>
            </div>

            {/* Collapsible Role Assignment & Direct Keys */}
            <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => setExpandBlobAdvanced(!expandBlobAdvanced)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {expandBlobAdvanced ? '▾ Hide Storage Role & Access Key Settings' : '▸ Show Storage Role Assignment & Direct Keys'}
              </button>

              {expandBlobAdvanced && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <strong style={{ fontSize: '11px', display: 'block' }}>Storage Blob Data Contributor Role:</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        Assign role to Managed Identity [{targetApp}].
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAssignBlobRole}
                      disabled={executingBlobRole}
                      style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--accent-cyan)', fontWeight: 700 }}
                    >
                      {executingBlobRole ? 'Assigning...' : '🛡️ Assign Storage Role'}
                    </button>
                  </div>

                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Direct Storage Key or Connection String (Optional)
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowStorageKey(!showStorageKey)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '10px', cursor: 'pointer' }}
                      >
                        {showStorageKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                    <input
                      type={showStorageKey ? 'text' : 'password'}
                      className="input"
                      value={storageAccessKey}
                      onChange={(e) => setStorageAccessKey(e.target.value)}
                      placeholder="e.g. AccountKey=wE7r...=="
                      style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '11px' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            {blobService?.lastResult || 'Awaiting connection test'}
          </div>
        </div>

        {/* CARD 3: Azure Key Vault */}
        <div className="panel" style={{ padding: '20px', background: '#ffffff', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🔐</span>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Azure Key Vault
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Centralized secrets management & encryption keys
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge type={vaultService?.status === 'CONNECTED' ? 'healthy' : 'danger'}>
                  {vaultService?.status || 'NOT CONFIGURED'}
                </StatusBadge>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleTestService('key-vault')}
                  disabled={testingServiceId === 'key-vault'}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  {testingServiceId === 'key-vault' ? 'Testing...' : '⚡ Test'}
                </button>
              </div>
            </div>

            {/* Input */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                Key Vault Endpoint URI (KEY_VAULT_URI)
              </label>
              <input
                type="url"
                className="input"
                value={keyVaultUri}
                onChange={(e) => setKeyVaultUri(e.target.value)}
                placeholder="e.g. https://your-key-vault.vault.azure.net"
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
              />
            </div>

            {/* Collapsible Role Assignment & Service Principal */}
            <div style={{ marginTop: '10px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <button
                type="button"
                onClick={() => setExpandVaultAdvanced(!expandVaultAdvanced)}
                style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '11px', fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                {expandVaultAdvanced ? '▾ Hide Secrets Role & Service Principal' : '▸ Show Key Vault Role Assignment & Service Principal'}
              </button>

              {expandVaultAdvanced && (
                <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <strong style={{ fontSize: '11px', display: 'block' }}>Key Vault Secrets User Role:</strong>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                        RBAC authorization for Managed Identity [{targetApp}].
                      </span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleAssignKeyVaultRole}
                      disabled={executingKeyVaultRole}
                      style={{ fontSize: '11px', padding: '4px 10px', color: 'var(--accent-cyan)', fontWeight: 700 }}
                    >
                      {executingKeyVaultRole ? 'Assigning...' : '🔑 Assign Secrets User Role'}
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Service Principal Client ID</label>
                      <input
                        type="text"
                        className="input"
                        value={keyVaultClientId}
                        onChange={(e) => setKeyVaultClientId(e.target.value)}
                        placeholder="00000000-0000-0000-0000-000000000000"
                        style={{ width: '100%', fontSize: '11px' }}
                      />
                    </div>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Client Secret</label>
                        <button
                          type="button"
                          onClick={() => setShowVaultSecret(!showVaultSecret)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent-cyan)', fontSize: '10px', cursor: 'pointer' }}
                        >
                          {showVaultSecret ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      <input
                        type={showVaultSecret ? 'text' : 'password'}
                        className="input"
                        value={keyVaultClientSecret}
                        onChange={(e) => setKeyVaultClientSecret(e.target.value)}
                        placeholder="••••••••••••"
                        style={{ width: '100%', fontSize: '11px' }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            {vaultService?.lastResult || 'Awaiting connection test'}
          </div>
        </div>

        {/* CARD 4: Power BI DirectQuery */}
        <div className="panel" style={{ padding: '20px', background: '#ffffff', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📊</span>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Power BI DirectQuery
                  </h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Executive exposure dashboard & relational view telemetry
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StatusBadge type={pbiService?.status === 'CONNECTED' ? 'healthy' : 'danger'}>
                  {pbiService?.status || 'NOT CONFIGURED'}
                </StatusBadge>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => handleTestService('power-bi')}
                  disabled={testingServiceId === 'power-bi'}
                  style={{ fontSize: '11px', padding: '4px 10px' }}
                >
                  {testingServiceId === 'power-bi' ? 'Validating...' : '⚡ Validate'}
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  Power BI Official HTTPS Report URL
                </label>
                <input
                  type="url"
                  className="input"
                  value={pbiUrl}
                  onChange={(e) => setPbiUrl(e.target.value)}
                  placeholder="https://app.powerbi.com/groups/me/reports/..."
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                  Report Name
                </label>
                <input
                  type="text"
                  className="input"
                  value={pbiName}
                  onChange={(e) => setPbiName(e.target.value)}
                  placeholder="e.g. Executive Exposure Telemetry"
                  style={{ width: '100%', fontSize: '12px' }}
                />
              </div>
            </div>
          </div>

          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            {pbiService?.lastResult || 'Awaiting URL validation (SSRF Allowlist enforced)'}
          </div>
        </div>

      </div>

      {/* Environment & App Service Runtime Synchronization Strip */}
      <div className="panel" style={{ padding: '18px 24px', background: '#ffffff', borderRadius: 'var(--radius-lg)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>☁️</span>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                Azure App Service & Runtime Environment
              </h4>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>
                Configure host application identity, resource group context, and synchronize active runtime settings.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRestartAppService}
              disabled={executingRestart}
              style={{ fontSize: '11px', padding: '6px 14px' }}
            >
              {executingRestart ? 'Reloading...' : '🔄 Apply & Reload Runtime'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', alignItems: 'center' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
              App Service Name
            </label>
            <input
              type="text"
              className="input"
              value={appServiceName}
              onChange={(e) => setAppServiceName(e.target.value)}
              placeholder="e.g. your-app-service-name"
              style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
              Resource Group
            </label>
            <input
              type="text"
              className="input"
              value={azureResourceGroup}
              onChange={(e) => setAzureResourceGroup(e.target.value)}
              placeholder="e.g. rg-production"
              style={{ width: '100%', fontSize: '12px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
              Azure Region
            </label>
            <input
              type="text"
              className="input"
              value={azureRegion}
              onChange={(e) => setAzureRegion(e.target.value)}
              placeholder="e.g. eastus"
              style={{ width: '100%', fontSize: '12px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', paddingTop: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
              <input
                type="checkbox"
                checked={managedIdentityEnabled}
                onChange={(e) => setManagedIdentityEnabled(e.target.checked)}
              />
              System-Assigned Managed Identity: ON
            </label>
          </div>
        </div>
      </div>

      {/* Collapsible Diagnostic Console */}
      <div style={{ background: '#090d16', borderRadius: 'var(--radius-md)', padding: '14px 20px', border: '1px solid #1e293b' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#f1f5f9' }}>
              Live Cloud Diagnostic Terminal
            </span>
            <span style={{ fontSize: '10px', color: '#64748b' }}>
              ({actionLogs.length} events logged)
            </span>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setShowLogs(!showLogs)}
              style={{ fontSize: '11px', padding: '3px 10px', background: 'rgba(255,255,255,0.08)', color: '#38bdf8', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
            >
              {showLogs ? '▾ Collapse Terminal' : '▸ Expand Terminal'}
            </button>
            {showLogs && (
              <button
                type="button"
                onClick={() => setActionLogs([{ timestamp: new Date().toLocaleTimeString(), type: 'info', message: 'Terminal cleared.' }])}
                style={{ fontSize: '11px', padding: '3px 8px', background: 'transparent', color: '#94a3b8', border: 'none', cursor: 'pointer' }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {showLogs && (
          <div style={{ marginTop: '12px', maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
            {actionLogs.map((log, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '10px', color: log.type === 'error' ? '#f43f5e' : log.type === 'success' ? '#10b981' : '#94a3b8' }}>
                <span style={{ color: '#475569' }}>[{log.timestamp}]</span>
                <span>{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

export default AzureIntegrationsView;
