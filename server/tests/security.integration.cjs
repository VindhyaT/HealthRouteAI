const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL.');

test('seed cannot promote existing patients and refuses production execution', async () => {
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const schema = 'audit_' + randomUUID().replaceAll('-', '');
  const url = new URL(process.env.TEST_DATABASE_URL);
  url.searchParams.set('options', `-c search_path=${schema},public`);
  const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' };
  const run = file => spawnSync(process.execPath, [path.join(__dirname, '../dist/database', file)], { env, encoding: 'utf8' });
  try {
    await pool.query(`CREATE SCHEMA ${schema}`);
    assert.equal(run('migrate.js').status, 0);
    await pool.query(`INSERT INTO ${schema}.users(name,email,password_hash,role) VALUES($1,$2,$3,$4)`, ['Existing patient', 'admin@healthroute.local', 'sentinel-hash', 'patient']);
    const result = run('seed.js');
    assert.equal(result.status, 0);
    const row = (await pool.query(`SELECT role,password_hash FROM ${schema}.users WHERE email=$1`, ['admin@healthroute.local'])).rows[0];
    assert.equal(row.role, 'patient');
    assert.equal(row.password_hash, 'sentinel-hash');
    assert(!result.stdout.includes('DemoPass123!'));
    env.NODE_ENV = 'production';
    assert.notEqual(run('seed.js').status, 0);
  } finally {
    await pool.query(`DROP SCHEMA ${schema} CASCADE`);
    await pool.end();
  }
});


test('CORS does not reflect an untrusted origin and admin rejects unauthenticated access', async () => {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.CLIENT_URL = 'http://localhost:5173';
  const { app } = require('../dist/app');
  const database = require('../dist/database');
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const response = await fetch(base + '/api/health', { headers: { Origin: 'https://untrusted.example' } });
    assert.equal(response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
    assert.notEqual(response.headers.get('access-control-allow-credentials'), 'true');
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      const result = await fetch(base + '/api/admin/departments' + (['PUT','PATCH','DELETE'].includes(method) ? '/00000000-0000-4000-8000-000000000000' : ''), { method });
      assert.equal(result.status, 401);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
    await database.pool.end();
  }
});
