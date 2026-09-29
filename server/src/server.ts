import { app } from './app';
import { initializeDatabase, pool } from './database';
import { validateAuthConfig } from './middleware/authMiddleware';
import { validateRuntimeConfig } from './runtimeConfig';

async function start() {
  const port = validateRuntimeConfig();
  validateAuthConfig();
  await initializeDatabase();
  const server = app.listen(port, () => console.log(`HealthRoute API listening on ${port}`));
  server.on('error', () => { console.error('API could not listen. Check PORT and port availability.'); process.exit(1); });
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    const timeout = setTimeout(() => process.exit(1), 15000);
    timeout.unref();
    server.close(() => {
      Promise.resolve(pool?.end()).then(() => process.exit(0), () => process.exit(1));
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
start().catch(() => {
  console.error('API startup failed. Check environment configuration, PostgreSQL connectivity, and migrations.');
  process.exit(1);
});
