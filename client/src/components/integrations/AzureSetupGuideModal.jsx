import React from 'react';

export function AzureSetupGuideModal({ onClose }) {
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
          maxWidth: '820px',
          maxHeight: '90vh',
          overflowY: 'auto',
          backgroundColor: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-glass-lg)',
          padding: '28px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
          <div>
            <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
              Azure Cloud Integration & Setup Guide
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Step-by-step instructions for configuring native Azure services and System-Assigned Managed Identity.
            </p>
          </div>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '4px 10px', fontSize: '12px' }}>
            ✕ Close
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', fontSize: '13px', color: 'var(--text-primary)' }}>
          {/* Step 1: Managed Identity */}
          <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
              1. Enable System-Assigned Managed Identity on App Service
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>
              Managed Identity eliminates the need to store passwords or connection strings in application configuration:
            </p>
            <ol style={{ paddingLeft: '20px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              <li>In the <strong>Azure Portal</strong>, navigate to your <strong>App Service</strong> instance.</li>
              <li>Under <strong>Settings</strong> in the left menu, select <strong>Identity</strong>.</li>
              <li>Under the <strong>System assigned</strong> tab, toggle <strong>Status</strong> to <strong>On</strong> and click <strong>Save</strong>.</li>
              <li>Copy the generated <strong>Object (principal) ID</strong> for use in role assignments.</li>
            </ol>
          </div>

          {/* Step 2: Azure SQL */}
          <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
              2. Authorize Managed Identity on Azure SQL Database
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '8px' }}>
              Grant the App Service's identity read/write access to the LeakLens database schema:
            </p>
            <ol style={{ paddingLeft: '20px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              <li>Ensure your Azure SQL Server has an <strong>Azure Active Directory admin</strong> assigned.</li>
              <li>In Azure SQL <strong>Networking</strong>, enable <em>"Allow Azure services and resources to access this server"</em>.</li>
              <li>Connect to the database via Azure Data Studio or SSMS as the Entra Admin and execute:</li>
            </ol>
            <pre style={{ margin: '10px 0', padding: '10px 14px', background: '#0f172a', color: '#38bdf8', borderRadius: 'var(--radius-sm)', fontSize: '12px', overflowX: 'auto', fontFamily: 'var(--font-mono)' }}>
{`-- Execute in target LeakLens database:
CREATE USER [<your-app-service-name>] FROM EXTERNAL PROVIDER;
ALTER ROLE db_datareader ADD MEMBER [<your-app-service-name>];
ALTER ROLE db_datawriter ADD MEMBER [<your-app-service-name>];
GRANT EXECUTE ON SCHEMA::leaklens TO [<your-app-service-name>];`}
            </pre>
          </div>

          {/* Step 3: Blob Storage */}
          <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
              3. Configure Private Blob Storage & RBAC
            </h3>
            <ol style={{ paddingLeft: '20px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              <li>Create a standard Azure Storage account with <strong>Allow Blob public access</strong> set to <strong>Disabled</strong>.</li>
              <li>Create a private container named <code>leaklens-scans</code>.</li>
              <li>In the Storage Account, select <strong>Access Control (IAM)</strong> → <strong>Add role assignment</strong>.</li>
              <li>Select the role <strong>Storage Blob Data Contributor</strong>.</li>
              <li>Assign access to <strong>Managed Identity</strong>, select your App Service, and click <strong>Save</strong>.</li>
            </ol>
          </div>

          {/* Step 4: Key Vault */}
          <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
              4. Configure Azure Key Vault & Secret References
            </h3>
            <ol style={{ paddingLeft: '20px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              <li>Create an Azure Key Vault using <strong>Azure role-based access control (RBAC)</strong>.</li>
              <li>Under <strong>Access Control (IAM)</strong>, assign the role <strong>Key Vault Secrets User</strong> to the App Service identity.</li>
              <li>Store sensitive values such as <code>SESSION-SECRET</code>.</li>
              <li>In App Service Configuration, reference secrets safely without embedding plaintext:
                <div style={{ marginTop: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'rgba(0,0,0,0.04)', padding: '6px 10px', borderRadius: '4px' }}>
                  @Microsoft.KeyVault(VaultName=kv-leaklens-prod;SecretName=SESSION-SECRET)
                </div>
              </li>
            </ol>
          </div>

          {/* Step 5: Power BI */}
          <div style={{ padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '8px' }}>
              5. Power BI DirectQuery & Safe Report Linking
            </h3>
            <ol style={{ paddingLeft: '20px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              <li>In Power BI Desktop, connect to Azure SQL using <strong>DirectQuery</strong> mode.</li>
              <li>Select views <code>leaklens.vw_exposure_analytics</code> and <code>leaklens.vw_incident_analytics</code>.</li>
              <li>Publish the report to an organizational Power BI Service workspace.</li>
              <li>Copy the official HTTPS URL (e.g., <code>https://app.powerbi.com/groups/.../reports/...</code>) into the LeakLens Power BI settings.</li>
            </ol>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <button className="btn btn-primary" onClick={onClose}>
            Understood & Return to Integrations
          </button>
        </div>
      </div>
    </div>
  );
}

export default AzureSetupGuideModal;
