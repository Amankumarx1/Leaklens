import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import errorHandler from '../server/src/middleware/errorHandler.js';

describe('Centralized Error Handling Middleware', () => {
  it('should format uncaught exceptions into standard error wire response', async () => {
    const testApp = express();
    testApp.get('/test-error', (req, res, next) => {
      const err = new Error('Database query failure simulation');
      err.statusCode = 503;
      err.code = 'SERVICE_UNAVAILABLE';
      next(err);
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/test-error');

    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(res.body.error.message).toBe('Database query failure simulation');
  });

  it('should default to status 500 when error status is not specified', async () => {
    const testApp = express();
    testApp.get('/crash', () => {
      throw new Error('Unexpected panic');
    });
    testApp.use(errorHandler);

    const res = await request(testApp).get('/crash');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
  });
});
