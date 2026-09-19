import cors from 'cors';
import express from 'express';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { apiRouter } from './routes.js';

export const createApp = () => {
  const app = express();
  app.use(cors({ origin: env.WEB_ORIGIN }));
  app.use(express.json());
  app.use('/api/v1', apiRouter);
  app.use(errorHandler);
  return app;
};
