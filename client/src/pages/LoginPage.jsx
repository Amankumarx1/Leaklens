import React, { useState } from 'react';
import { login } from '../services/api';

export function LoginPage({ onLoginSuccess, onNavigateToLanding }) {
  const [email, setEmail] = useState('admin@leaklens.local');
  const [password, setPassword] = useState('LeakLensDev2026!');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res?.success && res?.data?.user) {
        onLoginSuccess(res.data.user);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify enterprise credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-gradient-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 20px',
        position: 'relative'
      }}
    >
      {/* Decorative ambient background glows */}
      <div
        style={{
          position: 'absolute',
          top: '15%',
          left: '10%',
          width: '380px',
          height: '380px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(2, 132, 199, 0.08) 0%, rgba(2, 132, 199, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '15%',
          right: '10%',
          width: '340px',
          height: '340px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.06) 0%, rgba(16, 185, 129, 0) 70%)',
          pointerEvents: 'none',
          zIndex: 0
        }}
      />

      {/* Main Dual-Pane Container */}
      <div
        style={{
          width: '100%',
          maxWidth: '1080px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '32px',
          position: 'relative',
          zIndex: 1,
          alignItems: 'stretch'
        }}
      >
        {/* Left Pane: Enterprise Security Gateway Overview */}
        <div
          className="panel"
          style={{
            padding: '40px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(240, 249, 255, 0.9) 100%)',
            border: '1px solid var(--border-glass-strong)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: 'var(--shadow-glass-lg)'
          }}
        >
          <div>
            {/* Navigation back to public landing page */}
            {onNavigateToLanding && (
              <button
                type="button"
                id="btn-back-to-landing"
                onClick={onNavigateToLanding}
                className="btn btn-secondary"
                style={{
                  fontSize: '11px',
                  padding: '6px 14px',
                  marginBottom: '24px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                ← Back to Product Overview
              </button>
            )}

            {/* Perimeter Liveness Indicator */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 12px',
                borderRadius: 'var(--radius-pill)',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                marginBottom: '20px'
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--status-healthy)',
                  boxShadow: '0 0 8px var(--status-healthy)'
                }}
              />
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--status-healthy)', letterSpacing: '0.04em' }}>
                ZERO TRUST PERIMETER • ACTIVE
              </span>
            </div>

            {/* Brand Logo & Mission */}
            <div style={{ marginBottom: '24px' }}>
              <img
                src="/logo-full.png"
                alt="LeakLens Security Gateway"
                style={{
                  maxWidth: '220px',
                  width: '100%',
                  height: 'auto',
                  marginBottom: '12px',
                  filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.05))'
                }}
              />
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Enterprise Sensitive-Data Exposure Detection & Response. Inspecting volatile memory payloads before persistent SQL ingestion.
              </p>
            </div>

            {/* Security Architecture Guarantees */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '16px', lineHeight: 1 }}>🛡️</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    In-Memory Masking Pipeline
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Plaintext secrets are sanitized in volatile RAM before database commit.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '16px', lineHeight: 1 }}>⚡</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    20 Algorithmic Signatures
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Luhn mod-10 cards, Verhoeff national IDs, Shannon entropy & cloud keys.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <span style={{ fontSize: '16px', lineHeight: 1 }}>☁️</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Azure Native Cloud Foundation
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    Microsoft Entra Managed Identity, Key Vault caching & Azure Blob Storage.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Metadata */}
          <div
            style={{
              marginTop: '36px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}
          >
            <span>TLS 1.2+ Enforced</span>
            <span>DP-900 Relational Analytics</span>
          </div>
        </div>

        {/* Right Pane: Login Form & Persona Quick-Fill */}
        <div
          className="panel"
          style={{
            backgroundColor: 'var(--glass-surface-ultra)',
            backdropFilter: 'var(--glass-blur-heavy)',
            WebkitBackdropFilter: 'var(--glass-blur-heavy)',
            border: '1px solid var(--border-glass-strong)',
            borderRadius: 'var(--radius-xl)',
            padding: '36px 32px',
            boxShadow: 'var(--shadow-glass-lg)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          <div>
            <div style={{ marginBottom: '22px' }}>
              <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px 0', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
                Authenticate Operator Session
              </h2>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                Enter your Security Administrator credentials to access the unified platform.
              </p>
            </div>

            {error && (
              <div
                style={{
                  backgroundColor: 'var(--status-danger-bg)',
                  border: '1px solid var(--status-danger)',
                  color: 'var(--status-danger)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label
                  htmlFor="input-email"
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    color: 'var(--text-muted)',
                    marginBottom: '6px',
                    letterSpacing: '0.06em',
                    fontWeight: 700
                  }}
                >
                  Operator Email Address
                </label>
                <input
                  id="input-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@leaklens.local"
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                  <label
                    htmlFor="input-password"
                    style={{
                      display: 'block',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      color: 'var(--text-muted)',
                      letterSpacing: '0.06em',
                      fontWeight: 700
                    }}
                  >
                    Operator Master Key / Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--accent-cyan)',
                      fontSize: '11px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide password' : 'Show password'}
                  </button>
                </div>

                <div style={{ position: 'relative' }}>
                  <input
                    id="input-password"
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      color: 'var(--text-light)',
                      cursor: 'pointer',
                      fontSize: '14px',
                      padding: '4px'
                    }}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              <button
                id="btn-login-submit"
                type="submit"
                className="btn btn-primary"
                disabled={loading}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '12px',
                  marginTop: '4px',
                  fontWeight: 700,
                  fontSize: '13px'
                }}
              >
                {loading ? 'Verifying Credentials...' : 'Authenticate Session →'}
              </button>
            </form>

            {/* Unified Operator Clearance Panel */}
            <div style={{ marginTop: '24px', paddingTop: '18px', borderTop: '1px solid var(--border-subtle)' }}>
              <div
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'rgba(2, 132, 199, 0.04)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                    Unified Security Administrator Interface
                  </span>
                  <span
                    style={{
                      fontSize: '9px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-pill)',
                      color: 'var(--status-danger)',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.2)'
                    }}
                  >
                    FULL CLEARANCE
                  </span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  All operators access a single unified interface with complete Azure cloud connection controls, deep file inspection, and real-time incident remediation.
                </div>
              </div>
            </div>
          </div>

          {/* Compliance & Audit Policy Banner */}
          <div
            style={{
              marginTop: '20px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(100, 116, 139, 0.05)',
              border: '1px solid var(--border-subtle)',
              fontSize: '10px',
              color: 'var(--text-muted)',
              lineHeight: 1.4,
              textAlign: 'center'
            }}
          >
            Authorized operators only. Authentication events are cryptographically hashed and recorded to the immutable defensive audit register.
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
