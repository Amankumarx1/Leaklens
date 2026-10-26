import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import env from './config/env.js';
import requestLogger from './middleware/requestLogger.js';
import errorHandler from './middleware/errorHandler.js';
import notFoundHandler from './middleware/notFoundHandler.js';
import apiRouter from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and configures the Express application.
 * Hardened for Azure App Service production deployment:
 * - Reverse-proxy trust configuration
 * - HTTP security headers (CSP, HSTS, X-Frame-Options, nosniff)
 * - Single-origin production static asset delivery
 * - Isolated API routing and safe error handling
 */
export function createApp() {
  const app = express();

  // Trust first proxy in Azure App Service / front-door environment
  app.set('trust proxy', 1);

  // Disable technology footprint disclosure
  app.disable('x-powered-by');

  // Hardened Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; frame-ancestors 'none';"
    );

    // Enforce HSTS in production
    if (env.IS_PRODUCTION || req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }

    next();
  });

  // Strict CORS configuration
  const allowedOrigins = env.CLIENT_URL ? [env.CLIENT_URL, 'http://localhost:5173'] : ['*'];
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, same-origin)
        if (!origin || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy blocked access from origin ${origin}`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    })
  );

  // Cookie parsing for HttpOnly JWT session tokens
  app.use(cookieParser());

  // Request body parsing with sensible security limits
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Safe request logging (redacts secrets/tokens)
  app.use(requestLogger);

  // Mount API router
  app.use('/api', apiRouter);

  // Serve compiled production frontend if client/dist exists
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath, {
      maxAge: '1d',
      index: false
    }));

    // SPA Wildcard Route: Serve index.html for client-side navigation on non-API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      return res.sendFile(path.join(clientDistPath, 'index.html'));
    });
  }

  // Handle unmatched API routes
  app.use(notFoundHandler);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

export default createApp;
