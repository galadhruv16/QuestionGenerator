import { Router } from 'express';
import { meRouter } from './routes/me.js';
import { projectsRouter } from './routes/projects.js';

export const apiRouter = Router();

apiRouter.get('/health', (_request, response) => {
  response.json({ status: 'ok', service: 'groundq-api' });
});

apiRouter.use('/me', meRouter);
apiRouter.use('/projects', projectsRouter);
