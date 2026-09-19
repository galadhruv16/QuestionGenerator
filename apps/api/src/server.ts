import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();
app.listen(env.API_PORT, () =>
  console.log(`GroundQ API listening on http://localhost:${env.API_PORT}`),
);
