import { app } from './app';
import { initializeDatabase } from './database';
import { validateAuthConfig } from './middleware/authMiddleware';

const port = Number(process.env.PORT || 4000);
validateAuthConfig();
initializeDatabase().then(() => app.listen(port, () => console.log(`HealthRoute API listening on ${port}`)))
  .catch(error => { console.error('Database initialization failed', error); process.exit(1); });
