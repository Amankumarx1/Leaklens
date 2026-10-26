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
  updateIntegrationPreferences
} from '../../services/api';

export function AzureIntegrationsView({ user, onNavigateToDiagnostics }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals & Panels
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);
  const [selectedServiceDetail, setSelectedServiceDetail] = useState(null);

  // In-flight testing states
  const [testingServiceId, setTestingServiceId] = useState(null);
  const [testFeedback, setTestFeedback] = useState(null);

  // Power BI form state
  const [pbiName, setPbiName] = useState('');
  const [pbiUrl, setPbiUrl] = useState('');
  const [savingPbi, setSavingPbi] = useState(false);
  const [pbiSaveStatus, setPbiSaveStatus] = useState(null);

  // Copy notification
  const [copyStatus, setCopyStatus] = useState(null);

  const fetchIntegrationsData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getIntegrations();
      if (res?.data) {
        setData(res.data);
        if (res.data.preferences) {
          setPbiName(res.data.preferences.power_bi_report_name || 'Executive Exposure Telemetry');
          setPbiUrl(res.data.preferences.power_bi_report_url || '');
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load Azure integration metadata.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await getIntegrations();
        if (!ignore && res?.data) {
          setData(res.data);
          if (res.data.preferences) {
            setPbiName(res.data.preferences.power_bi_report_name || 'Executive Exposure Telemetry');
            setPbiUrl(res.data.preferences.power_bi_report_url || '');
          }
        }
      } catch (err) {
        if (!ignore) setError(err.message || 'Failed to load Azure integration metadata.');
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => { ignore = true; };
  }, []);

  // Execute test for a specific service
  const handleTestService = async (serviceId) => {
    try {
      setTestingServiceId(serviceId);
      setTestFeedback(null);
      let res;

      if (serviceId === 'sql') {
        res = await testSqlIntegration();
      } else if (serviceId === 'blob') {
        res = await testBlobIntegration();
      } else if (serviceId === 'key-vault') {
        res = await testKeyVaultIntegration();
      } else if (serviceId === 'power-bi') {
        res = await testPowerBiIntegration(pbiUrl);
      }

      if (res?.data) {
        setTestFeedback({
          serviceId,
          type: res.data.isConnected ? 'success' : 'warning',
          message: res.data.message
        });
        // Refresh full metadata to sync statuses
        const updated = await getIntegrations();
        if (updated?.data) {
          setData(updated.data);
          // Also update selected service detail if open
          if (selectedServiceDetail && selectedServiceDetail.id === serviceId) {
            setSelectedServiceDetail(updated.data.integrations.find(i => i.id === serviceId));
          }
        }
      }
    } catch (err) {
      setTestFeedback({
        serviceId,
        type: 'error',
        message: err.message || 'Test connection failed.'
      });
    } finally {
      setTestingServiceId(null);
    }
  };

  const handleSavePowerBi = async (e) => {
    e.preventDefault();
    try {
      setSavingPbi(true);
      setPbiSaveStatus(null);
      await updateIntegrationPreferences({
        power_bi_report_name: pbiName.trim(),
        power_bi_report_url: pbiUrl.trim()
      });
      setPbiSaveStatus({ type: 'success', message: 'Power BI report link saved and validated.' });
      setTimeout(() => setPbiSaveStatus(null), 3500);
      fetchIntegrationsData();
    } catch (err) {
      setPbiSaveStatus({ type: 'error', message: err.message || 'Failed to save Power BI preferences.' });
    } finally {
      setSavingPbi(false);
    }
  };

  const handleCopyConfigTemplate = (type = 'all') => {
    let template = '';
    if (type === 'sql') {
      template = `# LeakLens Azure SQL Database Configuration (App Service Settings)
DB_SERVER=${data?.integrations?.find(i => i.id === 'sql')?.serverName || 'your-server.database.windows.net'}
DB_NAME=${data?.integrations?.find(i => i.id === 'sql')?.databaseName || 'LeakLensDB'}
AZURE_SQL_AUTH_TYPE=azure-active-directory-default
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=false`;
    } else if (type === 'blob') {
      template = `# LeakLens Azure Blob Storage Configuration (App Service Settings)
AZURE_STORAGE_ACCOUNT_NAME=${data?.integrations?.find(i => i.id === 'blob')?.accountName || 'yourstorageaccount'}
AZURE_STORAGE_CONTAINER_NAME=leaklens-scans`;
    } else {
      template = `# LeakLens Azure Native Cloud Deployment Template (Non-Secret Parameters)
NODE_ENV=production
PORT=3000
DB_SERVER=${data?.integrations?.find(i => i.id === 'sql')?.serverName || 'leaklens-sql.database.windows.net'}
DB_NAME=LeakLensDB
AZURE_SQL_AUTH_TYPE=azure-active-directory-default
AZURE_STORAGE_ACCOUNT_NAME=${data?.integrations?.find(i => i.id === 'blob')?.accountName || 'leaklensscans'}
AZURE_STORAGE_CONTAINER_NAME=leaklens-scans
KEY_VAULT_URI=https://${data?.integrations?.find(i => i.id === 'key-vault')?.vaultUri ? data.integrations.find(i => i.id === 'key-vault').vaultUri.replace(/https:\/\/|\.vault\.azure\.net/g, '') : 'kv-leaklens'}.vault.azure.net
# Note: SESSION-SECRET and DB-PASSWORD must be loaded via Key Vault References:
# @Microsoft.KeyVault(VaultName=kv-leaklens;SecretName=SESSION-SECRET)`;
    }

    navigator.clipboard.writeText(template).then(() => {
      setCopyStatus(`Configuration template for ${type.toUpperCase()} copied to clipboard.`);
      setTimeout(() => setCopyStatus(null), 3000);
    });
  };

  if (loading && !data) {
    return (
      <div className="panel" style={{ padding: '36px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>Loading Azure integration configurations & status...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="panel" style={{ padding: '24px', borderLeft: '4px solid var(--status-danger)' }}>
        <h3 style={{ color: 'var(--status-danger)', marginBottom: '6px' }}>Failed to Load Azure Integrations</h3>
        <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
        <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={fetchIntegrationsData}>
          Retry
        </button>
      </div>
    );
  }

  const { overview, integrations } = data || {};
  const isAdmin = user?.role === 'ADMIN';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Azure Integrations
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Connect and monitor the cloud services that power LeakLens.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            id="btn-integrations-refresh"
            className="btn btn-secondary"
            onClick={fetchIntegrationsData}
            disabled={loading}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>

          <button
            id="btn-integrations-guide"
            className="btn btn-secondary"
            onClick={() => setShowGuideModal(true)}
            style={{ fontSize: '12px', padding: '6px 14px' }}
          >
            Setup Guide
          </button>

          <button
            id="btn-integrations-wizard"
            className="btn btn-primary"
            onClick={() => setShowWizardModal(true)}
            style={{ fontSize: '12px', padding: '6px 16px' }}
          >
            ⚡ Setup Wizard
          </button>

          {isAdmin && (
            <button
              id="btn-integrations-diagnostics"
              className="btn btn-secondary"
              onClick={onNavigateToDiagnostics}
              title="Jump to Runtime Cloud Architecture Diagnostics"
              style={{ fontSize: '12px', padding: '6px 14px' }}
            >
              View Diagnostics
            </button>
          )}
        </div>
      </div>

      {copyStatus && (
        <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--status-healthy-bg)', color: 'var(--status-healthy)', fontSize: '13px', fontWeight: 600, border: '1px solid var(--status-healthy)' }}>
          ✓ {copyStatus}
        </div>
      )}

      {testFeedback && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          fontSize: '13px',
          backgroundColor: testFeedback.type === 'success' ? 'var(--status-healthy-bg)' : 'var(--status-danger-bg)',
          color: testFeedback.type === 'success' ? 'var(--status-healthy)' : 'var(--status-danger)',
          border: `1px solid ${testFeedback.type === 'success' ? 'var(--status-healthy)' : 'var(--status-danger)'}`
        }}>
          <strong>{testFeedback.serviceId?.toUpperCase()}:</strong> {testFeedback.message}
        </div>
      )}

      {/* Overview Metric Bar */}
      <div className="panel" style={{ padding: '18px 24px', background: 'rgba(255, 255, 255, 0.95)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Services Monitored
            </div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text-primary)', marginTop: '2px' }}>
              {overview?.connectedCount} / {overview?.totalServices} Active
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Deployment Environment
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--accent-cyan)', marginTop: '4px', textTransform: 'uppercase' }}>
              {overview?.environment || 'development'}
            </div>
          </div>

          <div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
              Managed Identity
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <StatusBadge type={overview?.managedIdentityEnabled ? 'healthy' : 'warning'}>
                {overview?.managedIdentityEnabled ? 'Enabled & Detected' : 'Local / Not Verified'}
              </StatusBadge>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <button
              className="btn btn-secondary"
              onClick={() => handleCopyConfigTemplate('all')}
              style={{ fontSize: '11px', padding: '5px 12px' }}
              title="Copy non-secret App Service configuration template"
            >
              📋 Copy Configuration
            </button>
          </div>
        </div>
      </div>

      {/* 5 Core Connection Cards Grid */}
      <div>
        <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
          Core Cloud Services ({integrations?.length || 0})
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '18px' }}>
          {integrations?.map((service) => {
            const isTesting = testingServiceId === service.id;
            return (
              <div
                key={service.id}
                className="panel hover-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  background: 'rgba(255, 255, 255, 0.95)'
                }}
              >
                <div>
                  {/* Card Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                        {service.category}
                      </span>
                      <h4 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                        {service.name}
                      </h4>
                    </div>
                    <StatusBadge
                      type={
                        service.status === 'CONNECTED' ? 'healthy' :
                        service.status === 'DEGRADED' ? 'warning' :
                        service.status === 'NEEDS SETUP' ? 'warning' : 'danger'
                      }
                    >
                      {service.status}
                    </StatusBadge>
                  </div>

                  {/* Resource Identifier & Auth Method */}
                  <div style={{ fontSize: '12px', marginTop: '8px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Resource Identifier:</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--accent-cyan)', fontWeight: 600, wordBreak: 'break-all', marginTop: '2px' }}>
                      {service.resourceIdentifier}
                    </div>
                  </div>

                  <div style={{ fontSize: '12px', marginTop: '8px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '11px' }}>Authentication Mode:</div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {service.authMethod}
                    </div>
                  </div>

                  {/* Last Check Result */}
                  <div style={{ marginTop: '12px', padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '12px' }}>
                    <div style={{ color: 'var(--text-muted)', fontSize: '10px', textTransform: 'uppercase', fontWeight: 600 }}>Last Result</div>
                    <div style={{ color: service.status === 'CONNECTED' ? 'var(--status-healthy)' : 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.4 }}>
                      {service.lastResult}
                    </div>
                    {service.lastChecked && (
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                        {new Date(service.lastChecked).toLocaleTimeString()} {service.latencyMs ? `(${service.latencyMs}ms)` : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setSelectedServiceDetail(service)}
                    style={{ fontSize: '11px', padding: '5px 10px' }}
                  >
                    View Details
                  </button>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {service.canTest && (
                      <button
                        className="btn btn-primary"
                        onClick={() => handleTestService(service.id)}
                        disabled={isTesting}
                        style={{ fontSize: '11px', padding: '5px 12px' }}
                      >
                        {isTesting ? 'Testing...' : '⚡ Test Connection'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detailed Configuration Panels */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Panel 1: Azure SQL Configuration */}
        <div className="panel" style={{ padding: '22px' }}>
          <div className="panel-header">
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Azure SQL Database Configuration</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Relational schema verification, optimistic concurrency stored procedures, and Entra MSI access.
              </p>
            </div>
            <button className="btn btn-secondary" onClick={() => handleCopyConfigTemplate('sql')} style={{ fontSize: '11px', padding: '4px 10px' }}>
              Copy SQL Config
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginTop: '12px', fontSize: '12px' }}>
            <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Target Hostname</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {data?.integrations?.find(i => i.id === 'sql')?.serverName || 'localhost'}
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Database Name</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {data?.integrations?.find(i => i.id === 'sql')?.databaseName || 'LeakLensDB'}
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Schema Verification</div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                {data?.integrations?.find(i => i.id === 'sql')?.schemaStatus || 'VERIFIED'} (leaklens.* schema)
              </div>
            </div>

            <div style={{ padding: '10px 14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-muted)' }}>Encryption Standard</div>
              <div style={{ fontWeight: 600, color: 'var(--status-healthy)', marginTop: '2px' }}>
                TLS 1.2+ Enforced
              </div>
            </div>
          </div>
        </div>

        {/* Panel 2: Power BI Configuration & Validation */}
        <div className="panel" style={{ padding: '22px' }}>
          <div className="panel-header">
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>Power BI Executive Reporting Integration</h3>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                Configure, validate and link organizational Power BI dashboards federated via DirectQuery.
              </p>
            </div>
            {pbiUrl && (
              <a
                href={pbiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: '11px', padding: '4px 12px', textDecoration: 'none' }}
              >
                ↗ Open Report
              </a>
            )}
          </div>

          <form onSubmit={handleSavePowerBi} style={{ marginTop: '14px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {pbiSaveStatus && (
              <div style={{
                padding: '10px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '12px',
                backgroundColor: pbiSaveStatus.type === 'success' ? 'var(--status-healthy-bg)' : 'var(--status-danger-bg)',
                color: pbiSaveStatus.type === 'success' ? 'var(--status-healthy)' : 'var(--status-danger)',
                border: `1px solid ${pbiSaveStatus.type === 'success' ? 'var(--status-healthy)' : 'var(--status-danger)'}`
              }}>
                {pbiSaveStatus.message}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Report Display Name
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  value={pbiName}
                  onChange={(e) => setPbiName(e.target.value)}
                  placeholder="e.g. Executive Exposure Telemetry"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  Power BI Official Report URL (HTTPS)
                </label>
                <input
                  type="url"
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px' }}
                  value={pbiUrl}
                  onChange={(e) => setPbiUrl(e.target.value)}
                  placeholder="https://app.powerbi.com/groups/me/reports/..."
                  required
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button type="submit" className="btn btn-primary" disabled={savingPbi} style={{ fontSize: '12px', padding: '6px 16px' }}>
                {savingPbi ? 'Saving...' : 'Save & Validate Report Link'}
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleTestService('power-bi')}
                disabled={testingServiceId === 'power-bi' || !pbiUrl}
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                {testingServiceId === 'power-bi' ? 'Validating...' : 'Validate Link Syntax'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modals */}
      {showGuideModal && (
        <AzureSetupGuideModal onClose={() => setShowGuideModal(false)} />
      )}

      {showWizardModal && (
        <AzureSetupWizard
          currentMetadata={data}
          onClose={() => setShowWizardModal(false)}
          onComplete={fetchIntegrationsData}
        />
      )}

      {selectedServiceDetail && (
        <AzureServiceDetailModal
          service={selectedServiceDetail}
          onClose={() => setSelectedServiceDetail(null)}
          onTest={handleTestService}
          testing={testingServiceId === selectedServiceDetail.id}
        />
      )}
    </div>
  );
}

export default AzureIntegrationsView;
