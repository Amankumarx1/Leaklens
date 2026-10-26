import { describe, it, expect } from 'vitest';
import env from '../server/src/config/env.js';

describe('Configuration & Fail-Fast Environment Validation', () => {
  it('should load default development settings safely', () => {
    expect(env.NODE_ENV).toBeDefined();
    expect(env.PORT).toBeGreaterThan(0);
    expect(env.CLIENT_URL).toBeDefined();
    expect(env.DB).toBeDefined();
    expect(env.DB.port).toBe(1433);
    expect(env.DB.database).toBe('LeakLensDB');
  });

  it('should enforce that trustServerCertificate is disabled when NODE_ENV is production', () => {
    // If running in production, trustServerCertificate must be false
    if (env.IS_PRODUCTION) {
      expect(env.DB.options.trustServerCertificate).toBe(false);
    }
  });

  it('should validate port bounds', () => {
    expect(env.PORT).toBeGreaterThanOrEqual(1);
    expect(env.PORT).toBeLessThanOrEqual(65535);
  });
});
