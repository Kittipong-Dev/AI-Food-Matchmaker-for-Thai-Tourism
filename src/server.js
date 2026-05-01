import { env } from './config/env.js';
import app from './app.js';

if (!process.env.VERCEL) {
  app.listen(env.port, () => {
    console.log(`Server listening on http://localhost:${env.port}`);
  });
}

export default app;
