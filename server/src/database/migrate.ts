import '../env';
import fs from 'node:fs';
import path from 'node:path';
import { pool } from './index';

export async function migrate() {
  if (!pool) throw new Error('DATABASE_URL is required to run migrations.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Serialize concurrent startup and CLI migration runs.
    await client.query('SELECT pg_advisory_xact_lock(72419301)');
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
    const directory = path.join(__dirname, 'migrations');
    for (const migration of fs.readdirSync(directory).filter(file => file.endsWith('.sql')).sort()) {
      const applied = await client.query('SELECT 1 FROM schema_migrations WHERE version = $1', [migration]);
      if (applied.rowCount) continue;
      await client.query(fs.readFileSync(path.join(directory, migration), 'utf8'));
      await client.query('INSERT INTO schema_migrations(version) VALUES($1)', [migration]);
      console.log(`Applied ${migration}`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  migrate().then(() => console.log('Migrations complete.'))
    .catch(() => { console.error('Database migration failed. Check configuration and migration files.'); process.exitCode = 1; })
    .finally(() => pool?.end());
}
