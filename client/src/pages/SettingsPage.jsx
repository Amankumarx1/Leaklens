import React, { useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { getHealthStatus, clearAllScanData, login } from '../services/api';
import AzureIntegrationsView from '../components/integrations/AzureIntegrationsView';

const DEFAULT_PREFERENCES = {
  maxUploadThresholdMb: 5,
  maskingStyle: 'standard', // 'standard' | 'full'
  autoRefreshIntervalSec: 0 // 0 = off, 30, 60
};

export function SettingsPage({ health, user, onNavigate, onUserUpdate }) {
  const [activeTab, setActiveTab] = useState('integrations'); // Single unified interface: integrations is always active and accessible
  const [isElevating, setIsElevating] = useState(false);
  const [elevateError, setElevateError] = useState(null);
  
  // Profile & Preferences state
  const [displayName, setDisplayName] = useState(user?.display_name || user?.email || '');
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('leaklens_preferences');
      return saved ? { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) } : DEFAULT_PREFERENCES;
    } catch {
      return DEFAULT_PREFERENCES;
    }
  });

  const [saveStatus, setSaveStatus] = useState(null); // { type: 'success' | 'error', message: string }

  // Pattern Simulator state — starts clean without seeded fake data
  const [simulatorInput, setSimulatorInput] = useState('');
  const [simulatorResults, setSimulatorResults] = useState(null);

  // Live Diagnostics state
  const [diagnosticsHealth, setDiagnosticsHealth] = useState(health || null);
  const [pinging, setPinging] = useState(false);
  const [pingLatency, setPingLatency] = useState(null);

  // Clear data state
  const [clearingData, setClearingData] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearStatus, setClearStatus] = useState(null);

  const detectionRules = [
    { id: 'RULE-EMAIL', name: 'RFC Email Address Pattern', category: 'EMAIL_ADDRESS', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, severity: 'low', status: 'Enabled' },
    { id: 'RULE-API', name: 'Candidate API Key / Secret Token', category: 'API_KEY_CANDIDATE', regex: /\b(?:key_live_|key_test_|sk_live_|sk_test_|sk_demo_|api_key_|ghp_|gho_)[0-9a-zA-Z]{12,64}\b/g, severity: 'high', status: 'Enabled' },
    { id: 'RULE-AWS', name: 'AWS Access Key Identifier', category: 'CLOUD_CREDENTIAL', regex: new RegExp('\\bAKIA' + '[0-9A-Z]{16}\\b', 'g'), severity: 'critical', status: 'Enabled' },
    { id: 'RULE-STRIPE', name: 'Stripe Live Secret Key', category: 'CLOUD_CREDENTIAL', regex: /\b[sr]k_live_[0-9a-zA-Z]{24,}\b/g, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-DB', name: 'Database Connection URI with Credentials', category: 'DATABASE_CONNECTION_STRING', regex: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|mssql|redis):\/\/[a-zA-Z0-9._%+-]+:[^\s@]+@[a-zA-Z0-9.-]+/gi, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-PAN', name: 'Indian Permanent Account Number (PAN)', category: 'PERSONAL_IDENTIFIER', regex: /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g, severity: 'high', status: 'Enabled' },
    { id: 'RULE-SSN', name: 'US Social Security Number (SSN)', category: 'PERSONAL_IDENTIFIER', regex: /\b(?!000|666|9\d{2})\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b/g, severity: 'high', status: 'Enabled' },
    { id: 'RULE-CARD', name: 'Payment Card Candidate (Luhn Validated)', category: 'FINANCIAL_IDENTIFIER', regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13})\b/g, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-IBAN', name: 'International Bank Account Number (IBAN)', category: 'FINANCIAL_IDENTIFIER', regex: /\b[A-Z]{2}[0-9]{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-AZURE-STORAGE', name: 'Azure Storage Account Master Key', category: 'CLOUD_CREDENTIAL', regex: /(?:AccountKey\s*[:=]\s*["']?|AccountKey=)([a-zA-Z0-9+/]{86}==)/gi, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-AZURE-SAS', name: 'Azure Blob SAS Delegation Token', category: 'CLOUD_CREDENTIAL', regex: /(?:[\?&]sv=\d{4}-\d{2}-\d{2}[^\s"'<>]+sig=[a-zA-Z0-9%+/=]{43,88}|se=\d{4}-\d{2}-\d{2}[^\s"'<>]+sig=[a-zA-Z0-9%+/=]{43,88})/gi, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-GCP-SA', name: 'Google Cloud Service Account JSON Key', category: 'CLOUD_CREDENTIAL', regex: /"type"\s*:\s*"service_account"[\s\S]{1,250}?"private_key"/gi, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-VAULT', name: 'HashiCorp Vault Token (s. / hvs.)', category: 'CLOUD_CREDENTIAL', regex: /\b(?:s\.[a-zA-Z0-9]{24}|hvs\.[a-zA-Z0-9_\-]{24,36})\b/g, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-SENDGRID', name: 'SendGrid Email API Key', category: 'CLOUD_CREDENTIAL', regex: /\bSG\.[a-zA-Z0-9_\-]{22}\.[a-zA-Z0-9_\-]{43}\b/g, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-TWILIO', name: 'Twilio Account SID & Token', category: 'CLOUD_CREDENTIAL', regex: /\b(?:AC[0-9a-fA-F]{32}|SK[0-9a-fA-F]{32})\b/g, severity: 'high', status: 'Enabled' },
    { id: 'RULE-SLACK-WEBHOOK', name: 'Slack Incoming Webhook URL', category: 'CLOUD_CREDENTIAL', regex: /https:\/\/hooks\.slack\.com\/services\/T[0-9A-Z]{8,11}\/B[0-9A-Z]{8,11}\/[0-9a-zA-Z]{24}/g, severity: 'high', status: 'Enabled' },
    { id: 'RULE-DISCORD-WEBHOOK', name: 'Discord Webhook URL', category: 'CLOUD_CREDENTIAL', regex: /https:\/\/discord(?:app)?\.com\/api\/webhooks\/[0-9]{17,21}\/[a-zA-Z0-9_\-]{60,68}/g, severity: 'high', status: 'Enabled' },
    { id: 'RULE-PEM', name: 'Cryptographic Private Key Marker', category: 'PRIVATE_KEY_MARKER', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-NINO', name: 'UK National Insurance Number (NINO)', category: 'PERSONAL_IDENTIFIER', regex: /\b[A-Z]{2}\s?[0-9]{2}\s?[0-9]{2}\s?[0-9]{2}\s?[A-D]\b/gi, severity: 'high', status: 'Enabled' },
    { id: 'RULE-SIN', name: 'Canadian Social Insurance Number (SIN)', category: 'PERSONAL_IDENTIFIER', regex: /\b[0-9]{3}[ -][0-9]{3}[ -][0-9]{3}\b/g, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-PASSPORT', name: 'Indian Passport Identifier', category: 'PERSONAL_IDENTIFIER', regex: /\b[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]\b/g, severity: 'critical', status: 'Enabled' },
    { id: 'RULE-DL', name: 'Indian Driving License Number', category: 'PERSONAL_IDENTIFIER', regex: /\b[A-Z]{2}[0-9]{2}[ -]?[0-9]{11}\b/g, severity: 'high', status: 'Enabled' },
    { id: 'RULE-ID', name: 'Sensitive Enterprise Identifier', category: 'SENSITIVE_IDENTIFIER', regex: /\bLL-ID-[A-Z0-9]{4}-[A-Z0-9]{4}\b/g, severity: 'medium', status: 'Enabled' }
  ];

  const handleSavePreferences = (e) => {
    e.preventDefault();
    try {
      if (!displayName.trim()) {
        setSaveStatus({ type: 'error', message: 'Operator display name cannot be blank.' });
        return;
      }

      localStorage.setItem('leaklens_preferences', JSON.stringify(preferences));
      localStorage.setItem('leaklens_display_name', displayName.trim());

      setSaveStatus({ type: 'success', message: 'Operator preferences saved and persisted locally.' });
      setTimeout(() => setSaveStatus(null), 3500);
    } catch {
      setSaveStatus({ type: 'error', message: 'Failed to write preferences to local storage.' });
    }
  };

  const handleResetPreferences = () => {
    setPreferences(DEFAULT_PREFERENCES);
    setDisplayName(user?.display_name || user?.email || '');
    localStorage.removeItem('leaklens_preferences');
    localStorage.removeItem('leaklens_display_name');
    setSaveStatus({ type: 'success', message: 'Preferences reset to application defaults.' });
    setTimeout(() => setSaveStatus(null), 3000);
  };

  const handleRunSimulator = () => {
    if (!simulatorInput.trim()) {
      setSimulatorResults([]);
      return;
    }

    const matches = [];
    for (const rule of detectionRules) {
      const rx = new RegExp(rule.regex.source, rule.regex.flags);
      let match;
      while ((match = rx.exec(simulatorInput)) !== null) {
        const raw = match[0];
        let masked = raw;
        if (preferences.maskingStyle === 'full') {
          masked = '[CONFIDENTIAL_REDACTED]';
        } else if (raw.length > 8) {
          const prefix = raw.slice(0, 4);
          const suffix = raw.slice(-3);
          masked = `${prefix}***${suffix}`;
        } else {
          masked = '***';
        }

        matches.push({
          ruleName: rule.name,
          category: rule.category,
          severity: rule.severity,
          matchedSnippet: raw,
          maskedExcerpt: masked,
          index: match.index
        });
      }
    }

    setSimulatorResults(matches);
  };

  const handlePingDiagnostics = async () => {
    try {
      setPinging(true);
      const start = performance.now();
      const res = await getHealthStatus();
      const end = performance.now();
      setPingLatency(Math.round(end - start));
      if (res?.data) {
        setDiagnosticsHealth(res.data);
      }
    } catch {
      setPingLatency(null);
    } finally {
      setPinging(false);
    }
  };

  const handleClearOperationalData = async () => {
    try {
      setClearingData(true);
      await clearAllScanData();
      setClearConfirm(false);
      setClearStatus({ type: 'success', message: 'Operational scan and finding memory has been completely cleared.' });
      setTimeout(() => setClearStatus(null), 4000);
    } catch (err) {
      setClearStatus({ type: 'error', message: err.message || 'Failed to clear operational data.' });
    } finally {
      setClearingData(false);
    }
  };



  const isDbConnected = (diagnosticsHealth || health)?.components?.database?.status === 'connected';
  const isAdmin = true; // Single unified interface: every operator has full access

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
            Platform Settings & Diagnostics
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Operator preferences, live detection rule simulator, and runtime cloud architecture.
          </p>
        </div>
        {onNavigate && (
          <button className="btn btn-secondary" onClick={() => onNavigate('dashboard')} style={{ fontSize: '12px' }}>
            ← Back to Dashboard
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button
          id="tab-settings-integrations"
          className={`btn ${activeTab === 'integrations' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('integrations')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          Azure Integrations
        </button>

        <button
          id="tab-settings-profile"
          className={`btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('profile')}
        >
          Operator Profile & Preferences
        </button>

        <button
          id="tab-settings-rules"
          className={`btn ${activeTab === 'rules' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('rules')}
        >
          Detection Signatures & Simulator
        </button>

        <button
          id="tab-settings-diagnostics"
          className={`btn ${activeTab === 'diagnostics' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('diagnostics')}
        >
          Diagnostics & Cloud
        </button>
      </div>

      {/* TAB 0: Azure Integrations */}
      {activeTab === 'integrations' && (
        <AzureIntegrationsView
          user={user}
          onNavigateToDiagnostics={() => setActiveTab('diagnostics')}
        />
      )}

      {/* TAB 1: Profile & Preferences */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSavePreferences} style={{ maxWidth: '720px' }}>
          {saveStatus && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '13px',
              backgroundColor: saveStatus.type === 'success' ? 'var(--status-healthy-bg)' : 'var(--status-danger-bg)',
              color: saveStatus.type === 'success' ? 'var(--status-healthy)' : 'var(--status-danger)',
              border: `1px solid ${saveStatus.type === 'success' ? 'var(--status-healthy)' : 'var(--status-danger)'}`
            }}>
              {saveStatus.message}
            </div>
          )}

          <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="panel-header">
              <h3>Operator Identity</h3>
              <StatusBadge type={user?.role === 'ADMIN' ? 'danger' : user?.role === 'ANALYST' ? 'info' : 'warning'}>
                {user?.role || 'OPERATOR'}
              </StatusBadge>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Display Name
              </label>
              <input
                id="input-settings-display-name"
                type="text"
                className="input"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                style={{ width: '100%', maxWidth: '400px' }}
                placeholder="Enter your name or callsign"
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Assigned Identity / Email
              </label>
              <input
                type="text"
                className="input"
                value={user?.email || 'analyst@leaklens.local'}
                disabled
                style={{ width: '100%', maxWidth: '400px', opacity: 0.7, backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                Security Note: Email and role authority are strictly governed server-side and cannot be altered client-side.
              </span>
            </div>
          </div>

          <div className="panel" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="panel-header">
              <h3>Scanning & Masking Client Preferences</h3>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Max Upload Advisory Ceiling
              </label>
              <select
                id="select-settings-upload-threshold"
                className="input"
                style={{ maxWidth: '240px' }}
                value={preferences.maxUploadThresholdMb}
                onChange={(e) => setPreferences({ ...preferences, maxUploadThresholdMb: Number(e.target.value) })}
              >
                <option value={2}>2 MB (Strict Conservative)</option>
                <option value={5}>5 MB (LeakLens Default)</option>
                <option value={10}>10 MB (Enterprise Ceiling)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Redaction Preview Format
              </label>
              <div style={{ display: 'flex', gap: '16px', fontSize: '13px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="maskingStyle"
                    value="standard"
                    checked={preferences.maskingStyle === 'standard'}
                    onChange={() => setPreferences({ ...preferences, maskingStyle: 'standard' })}
                  />
                  <span>Standard Affix Masking (e.g., <code>AKIA***EXMP</code>)</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="maskingStyle"
                    value="full"
                    checked={preferences.maskingStyle === 'full'}
                    onChange={() => setPreferences({ ...preferences, maskingStyle: 'full' })}
                  />
                  <span>Full Redaction (<code>[CONFIDENTIAL_REDACTED]</code>)</span>
                </label>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Telemetry Auto-Refresh Rate
              </label>
              <select
                id="select-settings-refresh-rate"
                className="input"
                style={{ maxWidth: '240px' }}
                value={preferences.autoRefreshIntervalSec}
                onChange={(e) => setPreferences({ ...preferences, autoRefreshIntervalSec: Number(e.target.value) })}
              >
                <option value={0}>Disabled (Manual Refresh)</option>
                <option value={30}>Every 30 Seconds</option>
                <option value={60}>Every 60 Seconds</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
              <button id="btn-save-preferences" type="submit" className="btn btn-primary">
                Save Preferences
              </button>
              <button id="btn-reset-preferences" type="button" className="btn btn-secondary" onClick={handleResetPreferences}>
                Reset to Defaults
              </button>
            </div>
          </div>
        </form>
      )}

      {/* TAB 2: Rules & Pattern Simulator */}
      {activeTab === 'rules' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Detection Signatures */}
          <div className="panel">
            <div className="panel-header">
              <h3>Active Detection Signatures</h3>
              <StatusBadge type="healthy">{detectionRules.length} Signatures Active</StatusBadge>
            </div>

            <div style={{ overflowX: 'auto', marginTop: '12px' }}>
              <table className="table" style={{ width: '100%', fontSize: '13px', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '10px 12px' }}>Signature Name</th>
                    <th style={{ padding: '10px 12px' }}>Category</th>
                    <th style={{ padding: '10px 12px' }}>Severity</th>
                    <th style={{ padding: '10px 12px' }}>Regex Pattern Specification</th>
                    <th style={{ padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {detectionRules.map(rule => (
                    <tr key={rule.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{rule.name}</td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px' }}>{rule.category}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge type={rule.severity === 'critical' ? 'danger' : 'warning'}>
                          {rule.severity}
                        </StatusBadge>
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <code>{rule.regex.source}</code>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <StatusBadge type="healthy">{rule.status}</StatusBadge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Interactive Live Pattern Simulator */}
          <div className="panel">
            <div className="panel-header">
              <div>
                <h3>Interactive Pattern Scanner & Masking Simulator</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Test synthetic snippets against detection signatures in memory with instant redaction verification.
                </p>
              </div>
            </div>

            <div style={{ marginTop: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Candidate Test String / Configuration Dump
              </label>
              <textarea
                id="input-simulator-text"
                className="input"
                rows={4}
                value={simulatorInput}
                onChange={(e) => setSimulatorInput(e.target.value)}
                style={{ width: '100%', fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.5 }}
                placeholder="Paste sample config, env dump, or connection string to test detection signatures..."
              />

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button id="btn-run-simulator" className="btn btn-primary" onClick={handleRunSimulator}>
                  Simulate In-Memory Scan & Mask
                </button>
                <button className="btn btn-secondary" onClick={() => { setSimulatorInput(''); setSimulatorResults(null); }}>
                  Clear Text
                </button>
              </div>

              {simulatorResults !== null && (
                <div style={{ marginTop: '16px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Simulation Results ({simulatorResults.length} Matched)
                  </h4>
                  {simulatorResults.length === 0 ? (
                    <div style={{ padding: '12px', background: 'var(--status-healthy-bg)', borderRadius: 'var(--radius-sm)', color: 'var(--status-healthy)', fontSize: '13px' }}>
                      ✓ No secret signatures detected in sample input.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {simulatorResults.map((res, i) => (
                        <div key={i} style={{ padding: '10px 12px', background: 'rgba(255, 255, 255, 0.7)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: '13px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <span style={{ fontWeight: 600 }}>{res.ruleName}</span>
                            <StatusBadge type={res.severity === 'critical' ? 'danger' : 'warning'}>{res.severity}</StatusBadge>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            Masked Output:{' '}
                            <code style={{ color: 'var(--accent-cyan)', fontFamily: 'var(--font-mono)' }}>{res.maskedExcerpt}</code>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Diagnostics & Cloud Architecture */}
      {activeTab === 'diagnostics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {clearStatus && (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              backgroundColor: clearStatus.type === 'success' ? 'var(--status-healthy-bg)' : 'var(--status-danger-bg)',
              color: clearStatus.type === 'success' ? 'var(--status-healthy)' : 'var(--status-danger)',
              border: `1px solid ${clearStatus.type === 'success' ? 'var(--status-healthy)' : 'var(--status-danger)'}`
            }}>
              {clearStatus.message}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
            {/* Runtime Diagnostics */}
            <div className="panel">
              <div className="panel-header">
                <h3>Runtime Diagnostics</h3>
                <StatusBadge type="healthy">{(diagnosticsHealth || health)?.environment || 'production'}</StatusBadge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>API Gateway:</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{import.meta.env.VITE_API_URL || '/api'}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Liveness Status:</span>
                  <span style={{ color: 'var(--status-healthy)', fontWeight: 600 }}>
                    {(diagnosticsHealth || health)?.components?.api?.status === 'up' ? 'Online (HTTP 200)' : 'Pending'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Relational Database:</span>
                  <span style={{ color: isDbConnected ? 'var(--status-healthy)' : 'var(--status-warning)', fontWeight: 600 }}>
                    {isDbConnected ? 'Connected (Azure SQL / MSSQL)' : 'Degraded / Local Fallback'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Last Ping Latency:</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                    {pingLatency !== null ? `${pingLatency} ms` : 'Not tested'}
                  </span>
                </div>

                <div style={{ marginTop: '8px' }}>
                  <button
                    id="btn-ping-diagnostics"
                    className="btn btn-secondary"
                    onClick={handlePingDiagnostics}
                    disabled={pinging}
                    style={{ width: '100%', justifyContent: 'center' }}
                  >
                    {pinging ? 'Pinging /health...' : 'Execute Live Diagnostics Ping'}
                  </button>
                </div>
              </div>
            </div>

            {/* Cloud Security Architecture */}
            <div className="panel">
              <div className="panel-header">
                <h3>Cloud Security Architecture</h3>
                <StatusBadge type="info">Azure Native</StatusBadge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px', marginTop: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Transport Encryption:</span>
                  <span style={{ color: 'var(--status-healthy)' }}>HTTPS (TLS 1.2+ Enforced)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Object Storage Isolation:</span>
                  <span style={{ color: 'var(--status-healthy)' }}>Private Container (Dedicated Scans)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Service Identity:</span>
                  <span style={{ color: 'var(--status-healthy)' }}>Microsoft Entra Managed Identity</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Runtime Secrets:</span>
                  <span style={{ color: 'var(--status-healthy)' }}>Azure Key Vault (RBAC Authorized)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>HTTP Perimeter Headers:</span>
                  <span style={{ color: 'var(--status-healthy)' }}>CSP, HSTS, X-Frame-Options: DENY</span>
                </div>
              </div>
            </div>
          </div>

          {/* Platform Operational Reset (Admin only) */}
          {isAdmin && (
            <div className="panel" style={{ borderLeft: '4px solid var(--status-warning)' }}>
              <div className="panel-header">
                <div>
                  <h3 style={{ color: 'var(--text-primary)' }}>Operational Data Reset</h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                    Flush all in-memory or database scan executions, finding records, and incidents to restore a fresh zero-state.
                  </p>
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                {clearConfirm ? (
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: 'var(--status-danger)', fontWeight: 600 }}>
                      Are you sure? This action clears all operational scans and findings.
                    </span>
                    <button
                      id="btn-settings-confirm-clear"
                      className="btn btn-danger"
                      onClick={handleClearOperationalData}
                      disabled={clearingData}
                    >
                      {clearingData ? 'Clearing...' : 'Confirm Reset'}
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setClearConfirm(false)}
                      disabled={clearingData}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    id="btn-settings-clear-data"
                    className="btn btn-secondary"
                    onClick={() => setClearConfirm(true)}
                    style={{ color: 'var(--status-danger)', borderColor: 'var(--status-danger)' }}
                  >
                    Clear All Operational Data
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SettingsPage;
