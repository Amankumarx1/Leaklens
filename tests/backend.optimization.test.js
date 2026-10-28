import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server/src/app.js';
import { cacheService } from '../server/src/services/cache/cacheService.js';
import { createRateLimiter } from '../server/src/middleware/rateLimiter.js';
import { checkDatabaseHealth, resetHealthCache } from '../server/src/database/connection.js';
import { scanItems } from '../server/src/services/scanner/scannerEngine.js';

describe('Backend Optimization & Hardening Verification Suite', () => {
  beforeEach(() => {
    cacheService.clear();
    resetHealthCache();
  });

  // ============================================================================
  // 1. In-Memory TTL & LRU Cache Service
  // ============================================================================
  describe('In-Memory TTL & LRU Cache Service', () => {
    it('should store, retrieve, and honor TTL expiration', async () => {
      cacheService.set('test:key', { data: 'sample' }, 1); // 1 second TTL

      expect(cacheService.get('test:key')).toEqual({ data: 'sample' });

      // Fast wait for 1.1 seconds
      await new Promise(res => setTimeout(res, 1100));
      expect(cacheService.get('test:key')).toBeNull();
    });

    it('should wrap async functions and avoid redundant execution on cache hit', async () => {
      let callCount = 0;
      const expensiveQuery = async () => {
        callCount++;
        return { count: 42, timestamp: Date.now() };
      };

      const res1 = await cacheService.wrap('query:expensive', expensiveQuery, 10);
      const res2 = await cacheService.wrap('query:expensive', expensiveQuery, 10);

      expect(callCount).toBe(1);
      expect(res1).toEqual(res2);
    });

    it('should invalidate keys by prefix or regex pattern', () => {
      cacheService.set('analytics:summary', 1);
      cacheService.set('analytics:dashboard', 2);
      cacheService.set('rules:enabled', 3);

      const count = cacheService.invalidatePattern('analytics:');
      expect(count).toBe(2);
      expect(cacheService.get('analytics:summary')).toBeNull();
      expect(cacheService.get('analytics:dashboard')).toBeNull();
      expect(cacheService.get('rules:enabled')).toBe(3);
    });

    it('should evict oldest entry when capacity limit is reached', () => {
      const smallCache = new cacheService.constructor({ maxItems: 3, defaultTtlSec: 60 });
      smallCache.set('k1', 'v1');
      smallCache.set('k2', 'v2');
      smallCache.set('k3', 'v3');
      
      // Access k1 to make k2 the oldest accessed
      smallCache.get('k1');

      // Adding 4th item should evict k2
      smallCache.set('k4', 'v4');

      expect(smallCache.get('k2')).toBeNull();
      expect(smallCache.get('k1')).toBe('v1');
      expect(smallCache.get('k4')).toBe('v4');
    });
  });

  // ============================================================================
  // 2. Sliding-Window Rate Limiter
  // ============================================================================
  describe('Sliding-Window Rate Limiter', () => {
    it('should enforce rate limits and respond with 429 and standard headers', async () => {
      const express = (await import('express')).default;
      const testApp = express();
      const customLimiter = createRateLimiter({
        windowMs: 5000,
        max: 3,
        message: 'Throttled test',
        skip: () => false
      });

      testApp.get('/test-limit', customLimiter, (req, res) => res.json({ ok: true }));

      // Request 1: OK
      const r1 = await request(testApp).get('/test-limit');
      expect(r1.status).toBe(200);
      expect(r1.headers['ratelimit-remaining']).toBe('2');

      // Request 2: OK
      const r2 = await request(testApp).get('/test-limit');
      expect(r2.status).toBe(200);
      expect(r2.headers['ratelimit-remaining']).toBe('1');

      // Request 3: OK
      const r3 = await request(testApp).get('/test-limit');
      expect(r3.status).toBe(200);
      expect(r3.headers['ratelimit-remaining']).toBe('0');

      // Request 4: Exceeded -> 429 Too Many Requests
      const r4 = await request(testApp).get('/test-limit');
      expect(r4.status).toBe(429);
      expect(r4.body.success).toBe(false);
      expect(r4.headers['retry-after']).toBeDefined();

      customLimiter.limiterInstance.destroy();
    });
  });

  // ============================================================================
  // 3. Scanner Engine Optimization & Regex Reuse
  // ============================================================================
  describe('Scanner Engine High-Throughput Optimization', () => {
    it('should accurately detect secrets across items without stateful regex bleeding', () => {
      const items = [
        { location: 'line:1', content: 'export AWS_KEY=AKIAIOSFODNN7EXAMPLE;' },
        { location: 'line:2', content: 'const config = { harmless: true };' },
        { location: 'line:3', content: 'export STRIPE=' + 'sk_' + 'live_' + 'abcdef1234567890abcdef1234567890;' },
        { location: 'line:4', content: '' } // Empty line
      ];

      const findings = scanItems(items);
      expect(findings.length).toBeGreaterThanOrEqual(2);

      const awsFinding = findings.find(f => f.category === 'CLOUD_CREDENTIAL' && f.masked_excerpt.includes('AKIA'));
      expect(awsFinding).toBeDefined();
      expect(awsFinding.masked_excerpt).toContain('AKIA');
    });
  });

  // ============================================================================
  // 4. Observability & Telemetry Headers (X-Request-ID, X-Response-Time)
  // ============================================================================
  describe('HTTP Observability & Response Telemetry', () => {
    const app = createApp();

    it('should inject X-Request-ID and X-Response-Time on all API responses', async () => {
      const res = await request(app).get('/api/health');

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);
      expect(res.headers['x-response-time']).toBeDefined();
      expect(res.headers['x-response-time']).toMatch(/[0-9.]+ms/);
    });

    it('should propagate incoming X-Request-ID header when supplied by client or gateway', async () => {
      const customId = 'trace-client-uuid-9999-eastus';
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-ID', customId);

      expect(res.headers['x-request-id']).toBe(customId);
    });
  });
});
