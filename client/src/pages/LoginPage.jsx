import React, { useState } from 'react';
import { login } from '../services/api';

export function LoginPage({ onLoginSuccess }) {
  const [email, setEmail] = useState('analyst@leaklens.local');
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
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFill = (roleEmail) => {
    setEmail(roleEmail);
    setPassword('LeakLensDev2026!');
    setError(null);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '24px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '460px',
        backgroundColor: 'var(--glass-surface-ultra)',
        backdropFilter: 'var(--glass-blur-heavy)',
        WebkitBackdropFilter: 'var(--glass-blur-heavy)',
        border: '1px solid var(--border-glass-strong)',
        borderRadius: 'var(--radius-xl)',
        padding: '40px 36px',
        boxShadow: 'var(--shadow-glass-lg)'
      }}>
        {/* Brand Header with 3D Glowing Orb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
          <div className="brand-orb" style={{ width: '46px', height: '46px' }} aria-hidden="true" />
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
              LeakLens
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>
              Authorized Exposure Detection & Response
            </p>
          </div>
        </div>

        {error && (
          <div style={{
            backgroundColor: 'var(--status-danger-bg)',
            border: '1px solid var(--status-danger)',
            color: 'var(--status-danger)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            marginBottom: '20px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '6px', letterSpacing: '0.06em', fontWeight: 700 }}>
              Work Email
            </label>
            <input
              id="input-email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ display: 'block', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.06em', fontWeight: 700 }}>
                Master Key / Password
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
                style={{ paddingRight: '40px' }}
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
            style={{ width: '100%', justifyContent: 'center', padding: '12px', marginTop: '6px' }}
          >
            {loading ? 'Verifying Credentials...' : 'Authenticate Session →'}
          </button>
        </form>

        {/* Quick Role Fill Pills */}
        <div style={{ marginTop: '28px', paddingTop: '20px', borderTop: '1px solid rgba(226, 232, 240, 0.7)' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '10px', fontWeight: 700 }}>
            Quick-Fill Persona Credentials
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 14px' }}
              onClick={() => handleQuickFill('analyst@leaklens.local')}
            >
              SOC Analyst
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 14px' }}
              onClick={() => handleQuickFill('admin@leaklens.local')}
            >
              Administrator
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ fontSize: '11px', padding: '6px 14px' }}
              onClick={() => handleQuickFill('compliance@leaklens.local')}
            >
              Auditor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
