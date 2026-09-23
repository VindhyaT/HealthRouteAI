import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { pool } from './index';
import { departments, locations, faqs } from './demoData';

async function check() {
  if (!pool) throw new Error('DATABASE_URL is required to check PostgreSQL.');
  const client = await pool.connect();
  try {
    for (const table of ['users', 'departments', 'services', 'locations', 'department_locations', 'faqs', 'appointment_guidance']) {
      const result = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
      assert(result.rows[0].count > 0, `${table} must contain seed data`);
      console.log(`${table}: ${result.rows[0].count} rows`);
    }
    for (const department of departments) {
      const result = await client.query('SELECT id FROM departments WHERE name=$1', [department.name]);
      assert.equal(result.rowCount, 1, `Missing department: ${department.name}`);
      for (const service of department.services) {
        const found = await client.query('SELECT s.id FROM services s JOIN appointment_guidance a ON a.service_id=s.id WHERE s.department_id=$1 AND s.name=$2', [result.rows[0].id, service.name]);
        assert(found.rowCount, `Missing service or guidance: ${service.name}`);
      }
      for (const location of department.locations) {
        const found = await client.query('SELECT 1 FROM department_locations dl JOIN locations l ON l.id=dl.location_id WHERE dl.department_id=$1 AND l.name=$2', [result.rows[0].id, location.name]);
        assert.equal(found.rowCount, 1, `Missing location link: ${department.name}/${location.name}`);
      }
    }
    for (const location of locations) {
      const result = await client.query('SELECT 1 FROM locations WHERE name=$1 AND address=$2 AND phone=$3 AND hours=$4', [location.name, location.address, location.phone, location.hours]);
      assert.equal(result.rowCount, 1, `Missing location details: ${location.name}`);
    }
    for (const faq of faqs) {
      const result = await client.query('SELECT 1 FROM faqs WHERE question=$1 AND answer=$2', [faq.question, faq.answer]);
      assert.equal(result.rowCount, 1, 'Missing seeded FAQ');
    }
    for (const role of ['patient', 'admin']) {
      const result = await client.query('SELECT * FROM users WHERE email=$1', [`${role}@healthroute.local`]);
      assert.equal(result.rowCount, 1, `Missing demo ${role}`);
      assert.equal(result.rows[0].role, role);
      assert(await bcrypt.compare('DemoPass123!', result.rows[0].password_hash), `Demo ${role} password differs (existing passwords are preserved by seeding)`);
      assert(result.rows[0].created_at);
    }
    // Exercise constraints inside a transaction; no test records persist.
    await client.query('BEGIN');
    for (const [sql, code] of [
      ["INSERT INTO users(name,email,password_hash,role) VALUES('Constraint test',gen_random_uuid()::text,'test','owner')", '23514'],
      ["INSERT INTO services(department_id,name,description,appointment_info) VALUES(gen_random_uuid(),'test','test','test')", '23503'],
      ["INSERT INTO department_locations VALUES(gen_random_uuid(),gen_random_uuid())", '23503'],
      ["INSERT INTO appointment_guidance(service_id,title,instructions) VALUES(gen_random_uuid(),'test','test')", '23503'],
      ["INSERT INTO users(name,email,password_hash) SELECT name,email,password_hash FROM users LIMIT 1", '23505']
    ]) {
      await client.query('SAVEPOINT constraint_check');
      let actualCode: string | undefined;
      try { await client.query(sql); } catch (error) { actualCode = (error as { code: string }).code; }
      await client.query('ROLLBACK TO SAVEPOINT constraint_check');
      assert.equal(actualCode, code, `Expected constraint error ${code}`);
    }
    await client.query('ROLLBACK');
    console.log('PASS: seed data, demo passwords, roles, unique email, and foreign keys verified.');
  } finally {
    await client.query('ROLLBACK');
    client.release();
  }
}
check().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => pool?.end());
