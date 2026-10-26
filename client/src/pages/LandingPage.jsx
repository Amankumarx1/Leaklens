import React, { useState } from 'react';

const CATEGORIES = [
  { id: 'cloud', name: 'Cloud Credentials', desc: 'AWS AKIA keys, Azure Connection Strings, GCP service tokens', severity: 'CRITICAL', color: 'var(--status-danger)' },
  { id: 'db', name: 'Database Connection Strings', desc: 'PostgreSQL, MySQL, MongoDB, MSSQL, Redis connection URIs with embedded passwords', severity: 'CRITICAL', color: 'var(--status-danger)' },
  { id: 'keys', name: 'Cryptographic Private Keys', desc: 'RSA, EC, DSA, OpenSSH PEM blocks and private key markers', severity: 'CRITICAL', color: 'var(--status-danger)' },
  { id: 'tokens', name: 'API & Service Tokens', desc: 'GitHub PATs, Stripe live secrets, Slack bot/user tokens, SendGrid keys', severity: 'HIGH', color: 'var(--status-warning)' },
  { id: 'finance', name: 'Financial Identifiers', desc: 'Payment cards (Visa, Mastercard, Amex) with Luhn algorithmic checksum validation', severity: 'CRITICAL', color: 'var(--status-danger)' },
  { id: 'national', name: 'National Identity Identifiers', desc: 'Indian PAN alphanumeric format and Aadhaar with Verhoeff checksum algorithm', severity: 'HIGH', color: 'var(--status-warning)' },
  { id: 'secrets', name: 'High-Entropy Passwords', desc: 'Shannon entropy evaluation (>4.5 bits/char) with proximity keyword scoring', severity: 'HIGH', color: 'var(--status-warning)' },
  { id: 'pii', name: 'PII & Communication Data', desc: 'RFC 5322 email addresses and phone numbers for privacy regulation compliance', severity: 'LOW', color: 'var(--accent-cyan)' }
];

export function LandingPage({ onNavigateToLogin }) {
  const [activeTabPreview, setActiveTabPreview] = useState('raw'); // 'raw' | 'masked'

  const sampleRawText = `[production-environment-dump.env]
DB_CONNECTION="postgresql://postgres:SuperSecretP@ss2026@prod-db.internal:5432/leaklens_db"
AWS_ACCESS_KEY_ID="AKIA-EXPOSURE-DEMO-UNPROTECTED"
STRIPE_KEY="sk_test_mock_sample_payment_key_demo"
CLIENT_PRIMARY_CARD="4532-0150-1234-5678"
SECURITY_LEAD_EMAIL="ciso-office@enterprise-corp.com"
ENCRYPTION_KEY="[SAMPLE_PRIVATE_KEY_BLOCK_UNENCRYPTED]
MIIEowIBAAKCAQEA0Y1+..."`;

  const sampleMaskedText = `[production-environment-dump.env]
DB_CONNECTION="postgresql://postgres:[REDACTED_SECRET]@prod-db.internal:5432/leaklens_db"
AWS_ACCESS_KEY_ID="AKIA***CTED" [SHA256: 7f83b165... Verified Context: AWS Key]
STRIPE_KEY="sk_test_***demo" [Severity: HIGH, Category: SERVICE_TOKEN]
CLIENT_PRIMARY_CARD="4532-****-****-5678" [Luhn Checksum: PASSED]
SECURITY_LEAD_EMAIL="ciso***.com" [Category: EMAIL_ADDRESS]
ENCRYPTION_KEY="[REDACTED_PRIVATE_KEY_MARKER]"`;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-gradient-base)', color: 'var(--text-primary)', display: 'flex', flexDirection: 'column' }}>
      {/* Top Public Navigation Bar */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          backgroundColor: 'rgba(255, 255, 255, 0.88)',
          backdropFilter: 'var(--glass-blur-heavy)',
          WebkitBackdropFilter: 'var(--glass-blur-heavy)',
          borderBottom: '1px solid var(--border-glass)',
          padding: '16px 36px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <img
            src="/logo-full.png"
            alt="LeakLens"
            style={{ height: '38px', width: 'auto', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.06))' }}
          />
          <span style={{ fontSize: '11px', background: 'var(--accent-cyan-subtle)', color: 'var(--accent-cyan)', padding: '3px 8px', borderRadius: 'var(--radius-pill)', fontWeight: 700, border: '1px solid var(--accent-cyan-border)' }}>
            SOC ENTERPRISE v2.0
          </span>
        </div>

        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <a href="#capabilities" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
            Capabilities
          </a>
          <a href="#detection" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
            Detection Engine
          </a>
          <a href="#azure" style={{ textDecoration: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 600 }}>
            Azure Native
          </a>
          <button
            id="btn-landing-nav-login"
            className="btn btn-primary"
            onClick={onNavigateToLogin}
            style={{ fontSize: '12px', padding: '8px 18px' }}
          >
            Access Security Console →
          </button>
        </nav>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '72px 24px 60px', maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: 'var(--radius-pill)', backgroundColor: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.25)', marginBottom: '20px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--status-healthy)' }} />
          <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-cyan)' }}>
            Authorized Sensitive-Data Exposure Detection & Response
          </span>
        </div>

        <h1 style={{ fontSize: '48px', fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.15, maxWidth: '960px', margin: '0 auto 20px', color: 'var(--text-primary)' }}>
          Stop Credential Leaks Before They Reach Persistent Storage.
        </h1>

        <p style={{ fontSize: '16px', color: 'var(--text-secondary)', maxWidth: '780px', margin: '0 auto 36px', lineHeight: 1.6 }}>
          LeakLens scans configuration dumps, log files, and source code in <strong>volatile RAM</strong>, immediately redacting sensitive secrets with cryptographic affix masks, Shannon entropy algorithms, and atomic incident management.
        </p>

        <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            id="btn-hero-launch-console"
            className="btn btn-primary"
            onClick={onNavigateToLogin}
            style={{ fontSize: '14px', padding: '12px 28px', boxShadow: '0 8px 24px -4px rgba(2, 132, 199, 0.35)' }}
          >
            Launch Security Console →
          </button>

          <a
            href="#capabilities"
            className="btn btn-secondary"
            style={{ fontSize: '14px', padding: '12px 24px', textDecoration: 'none' }}
          >
            Explore Platform Features ↓
          </a>
        </div>

        {/* Live Metrics Ticker Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginTop: '56px',
            textAlign: 'left'
          }}
        >
          <div className="panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.95)' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--accent-cyan)' }}>20 Rules</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
              Canonical Detection Signatures
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Regex + Luhn + Verhoeff + Shannon
            </div>
          </div>

          <div className="panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.95)' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--status-healthy)' }}>0 Secrets</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
              Plaintext Ingestion Exposure
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Redacted in RAM prior to SQL insert
            </div>
          </div>

          <div className="panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.95)' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--accent-purple)' }}>10 Categories</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
              Exposure Taxonomy Scope
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Cloud, DB, Tokens, Keys, PII, Cards
            </div>
          </div>

          <div className="panel" style={{ padding: '20px', background: 'rgba(255, 255, 255, 0.95)' }}>
            <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--accent-coral)' }}>Azure Native</div>
            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600, marginTop: '2px' }}>
              Managed Identity & Cloud SQL
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Zero static passwords in config
            </div>
          </div>
        </div>
      </section>

      {/* Interactive In-Memory Masking Demonstration Section */}
      <section style={{ padding: '40px 24px 60px', backgroundColor: 'rgba(255, 255, 255, 0.7)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-cyan)', fontWeight: 800 }}>
              Live Data-Loss Prevention Demonstration
            </span>
            <h2 style={{ fontSize: '28px', fontWeight: 800, margin: '6px 0', letterSpacing: '-0.02em' }}>
              Cryptographic Masking in Volatile RAM
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              See how raw configuration payloads are analyzed and sanitized before database insertion.
            </p>
          </div>

          <div className="panel" style={{ padding: '0', overflow: 'hidden', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', background: '#0f172a', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b' }} />
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10b981' }} />
                <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: '10px', fontFamily: 'var(--font-mono)' }}>
                  leaklens-in-memory-parser.sh
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  className={`btn ${activeTabPreview === 'raw' ? 'btn-danger' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '4px 12px' }}
                  onClick={() => setActiveTabPreview('raw')}
                >
                  Raw Input (Exposed Secrets)
                </button>
                <button
                  className={`btn ${activeTabPreview === 'masked' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '11px', padding: '4px 12px' }}
                  onClick={() => setActiveTabPreview('masked')}
                >
                  Sanitized & Redacted Output
                </button>
              </div>
            </div>

            <pre style={{ margin: 0, padding: '24px', background: '#090d16', color: activeTabPreview === 'raw' ? '#fca5a5' : '#38bdf8', fontSize: '13px', lineHeight: 1.6, overflowX: 'auto', fontFamily: 'var(--font-mono)' }}>
              {activeTabPreview === 'raw' ? sampleRawText : sampleMaskedText}
            </pre>
          </div>
        </div>
      </section>

      {/* 4 Core Pillars Section */}
      <section id="capabilities" style={{ padding: '64px 24px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '44px' }}>
          <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-cyan)', fontWeight: 800 }}>
            Enterprise Security Pillars
          </span>
          <h2 style={{ fontSize: '32px', fontWeight: 800, margin: '6px 0', letterSpacing: '-0.02em' }}>
            Built for Zero-Trust Boundary Defense
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '22px' }}>
          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(2, 132, 199, 0.12)', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>
              ⚡
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>In-Memory File Scanning</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Inspects `.env`, `.json`, `.csv`, `.ini`, `.yaml`, `.xml`, `.md`, and source files entirely in RAM. Plaintext sensitive strings are masked before SQL persistence.
            </p>
          </div>

          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(5, 150, 105, 0.12)', color: 'var(--status-healthy)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>
              🛡️
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Algorithmic Verification</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Eliminates false positives with Luhn mod-10 card validation, Verhoeff national identity checksums, Shannon entropy calculation, and contextual proximity keywords.
            </p>
          </div>

          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(124, 58, 237, 0.12)', color: 'var(--accent-purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>
              ⚖️
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Atomic Incident Lifecycle</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Transactional state machine (`sp_resolve_incident`) with optimistic concurrency version tokens and immutable, tamper-resistant audit trails.
            </p>
          </div>

          <div className="panel" style={{ padding: '24px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(225, 29, 72, 0.12)', color: 'var(--accent-coral)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '14px' }}>
              ☁️
            </div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '6px' }}>Azure Cloud Architecture</h3>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Native Microsoft Entra Managed Identity, private Azure Blob Storage containers, Azure Key Vault secret caching, and Power BI DirectQuery integration.
            </p>
          </div>
        </div>
      </section>

      {/* Detection Taxonomy Scope Section */}
      <section id="detection" style={{ padding: '60px 24px', backgroundColor: 'rgba(255, 255, 255, 0.65)', borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent-cyan)', fontWeight: 800 }}>
              Broad-Spectrum Detection Coverage
            </span>
            <h2 style={{ fontSize: '30px', fontWeight: 800, margin: '6px 0', letterSpacing: '-0.02em' }}>
              10 Sensitive Data Exposure Categories
            </h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {CATEGORIES.map(cat => (
              <div key={cat.id} className="panel hover-card" style={{ padding: '18px', background: '#ffffff', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{cat.name}</h4>
                  <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: 'var(--radius-pill)', color: cat.color, border: `1px solid ${cat.color}` }}>
                    {cat.severity}
                  </span>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                  {cat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ready To Launch Call to Action */}
      <section style={{ padding: '64px 24px 80px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '32px', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '14px' }}>
          Ready to Audit Your Sensitive Data Surface?
        </h2>
        <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '28px' }}>
          Log in with your authorized SOC credentials to begin scanning files, tracking incident containment, and verifying Azure cloud architecture.
        </p>
        <button
          id="btn-footer-login"
          className="btn btn-primary"
          onClick={onNavigateToLogin}
          style={{ fontSize: '14px', padding: '12px 32px' }}
        >
          Access Security Gateway →
        </button>
      </section>

      {/* Footer */}
      <footer style={{ marginTop: 'auto', padding: '24px 36px', borderTop: '1px solid var(--border-subtle)', backgroundColor: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
        <div>
          <strong>LeakLens</strong> • Authorized Data Exposure Detection & Response Platform
        </div>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span>TLS 1.2+ Enforced</span>
          <span>DP-900 Relational Analytics</span>
          <span>Zero Secrets Persisted</span>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
