import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes.js';

export const createApp = () => {
  const app = express();
  const allowedOrigin = env.WEB_ORIGIN;
  app.use(
    cors({
      credentials: true,
      origin:
        allowedOrigin === '*'
          ? true
          : (origin, callback) => {
              if (!origin) return callback(null, true);
              if (
                origin === allowedOrigin ||
                origin.endsWith('.vercel.app') ||
                origin.includes('localhost')
              ) {
                return callback(null, true);
              }
              return callback(null, true);
            },
    }),
  );
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/v1', apiRouter);
  app.use(errorHandler);
  return app;
};
