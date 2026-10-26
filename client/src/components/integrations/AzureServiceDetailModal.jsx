import React from 'react';
import StatusBadge from '../StatusBadge';

export function AzureServiceDetailModal({ service, onClose, onTest, testing }) {
  if (!service) return null;

  const isConnected = service.status === 'CONNECTED';
  const isFailed = service.status === 'CONNECTION_FAILED';

  const getTroubleshootingTips = () => {
    switch (service.id) {
      case 'sql':
        return [
          'Verify that Azure SQL Server Firewall allows Azure Services ("Allow Azure services and resources to access this server" = Yes).',
          'Ensure the App Service Managed Identity has been created as an external user in the database: CREATE USER [app-name] FROM EXTERNAL PROVIDER.',
          'Verify that the required role memberships (db_datareader, db_datawriter) have been assigned.',
          'Check that the database name matches DB_NAME exactly.'
        ];
      case 'blob':
        return [
          'Verify that the Storage Account Name exists and is correctly spelled in AZURE_STORAGE_ACCOUNT_NAME.',
          'Ensure the App Service Managed Identity has the "Storage Blob Data Contributor" role assigned in Azure Portal IAM.',
          'Check that storage networking does not block App Service outbound IP addresses.',
          'Confirm that the container name "leaklens-scans" exists or identity has permission to create it.'
        ];
      case 'key-vault':
        return [
          'Verify that KEY_VAULT_URI is a valid HTTPS URI ending with .vault.azure.net.',
          'Ensure the App Service Managed Identity has been assigned "Key Vault Secrets User" under Key Vault Access Control (IAM).',
          'If using Access Policies (legacy model), ensure "Get" and "List" secret permissions are granted.',
          'Check that Key Vault firewall allows trusted Microsoft services.'
        ];
      case 'power-bi':
        return [
          'Ensure the report URL begins with https:// and points to official Power BI domain (app.powerbi.com).',
          'Verify that the logged-in user in your browser has organizational access to the target workspace.',
          'Ensure DirectQuery dataset in Power BI has valid Azure SQL credentials configured in Service settings.'
        ];
      case 'app-service':
        return [
          'Verify that System-Assigned Managed Identity is toggled to "On" in App Service Identity settings.',
          'Confirm that all required Application Settings (DB_SERVER, DB_NAME, etc.) are applied in App Service Configuration.',
          'Restart the App Service after updating environment variables.'
        ];
      default:
        return ['Review the application logs for further diagnostic traces.'];
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
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
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
          maxWidth: '680px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-glass-lg)',
          padding: '26px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '18px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                {service.name}
              </h2>
              <StatusBadge
                type={
                  service.status === 'CONNECTED' ? 'healthy' :
                  service.status === 'DEGRADED' ? 'warning' :
                  service.status === 'CHECKING' ? 'info' :
                  service.status === 'NEEDS SETUP' ? 'warning' : 'danger'
                }
              >
                {service.status}
              </StatusBadge>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Category: <strong>{service.category}</strong> • Auth: <strong>{service.authMethod}</strong>
            </p>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '4px 10px', fontSize: '12px' }}>
            ✕ Close
          </button>
        </div>

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', fontSize: '13px' }}>
          {/* Resource ID & Diagnostic Banner */}
          <div style={{ background: 'var(--bg-app)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
              Configured Resource Identifier
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--accent-cyan)', fontWeight: 600, marginTop: '4px', wordBreak: 'break-all' }}>
              {service.resourceIdentifier}
            </div>

            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-subtle)', paddingTop: '10px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
                Latest Connectivity Result
              </div>
              <div style={{ color: isConnected ? 'var(--status-healthy)' : isFailed ? 'var(--status-danger)' : 'var(--text-secondary)', marginTop: '2px', fontWeight: 500 }}>
                {service.lastResult}
              </div>
              {service.lastChecked && (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Checked: {new Date(service.lastChecked).toLocaleString()} {service.latencyMs ? `(${service.latencyMs}ms)` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Service Specific Details */}
          {service.details && (
            <div className="panel" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                Security & Architecture Attributes
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginTop: '4px' }}>
                {Object.entries(service.details).map(([key, val]) => (
                  <div key={key} style={{ padding: '8px 12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                      {key.replace(/([A-Z])/g, ' $1')}
                    </div>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                      {val}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Troubleshooting Checklist */}
          <div style={{ padding: '14px', background: 'rgba(2, 132, 199, 0.04)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(2, 132, 199, 0.15)' }}>
            <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-cyan)', margin: 0, marginBottom: '6px' }}>
              Azure Portal Configuration & Troubleshooting Checklist
            </h4>
            <ul style={{ paddingLeft: '18px', lineHeight: 1.6, color: 'var(--text-secondary)', fontSize: '12px' }}>
              {getTroubleshootingTips().map((tip, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>{tip}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Actions */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px' }}>
          <div>
            {service.canTest && (
              <button
                className="btn btn-primary"
                onClick={() => onTest(service.id)}
                disabled={testing}
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                {testing ? 'Testing Connectivity...' : '⚡ Test Connection Now'}
              </button>
            )}
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ fontSize: '12px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default AzureServiceDetailModal;
