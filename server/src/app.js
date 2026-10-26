import express from 'express';
import cors from 'cors';
import env from './config/env.js';
import requestLogger from './middleware/requestLogger.js';
import errorHandler from './middleware/errorHandler.js';
import notFoundHandler from './middleware/notFoundHandler.js';
import apiRouter from './routes/index.js';

/**
 * Creates and configures the Express application.
 * Application instantiation is separated from server listen lifecycle for unit testing.
 */
export function createApp() {
  const app = express();

  // Basic security hardening headers
  app.disable('x-powered-by');

  // Strict CORS configuration
  const allowedOrigins = env.CLIENT_URL ? [env.CLIENT_URL, 'http://localhost:5173'] : ['*'];
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, postman)
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

  // Request body parsing with sensible security limits
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  // Safe request logging (redacts secrets/tokens)
  app.use(requestLogger);

  // Mount API router
  app.use('/api', apiRouter);

  // Handle unmatched API routes
  app.use(notFoundHandler);

  // Centralized error handling
  app.use(errorHandler);

  return app;
}

export default createApp;
