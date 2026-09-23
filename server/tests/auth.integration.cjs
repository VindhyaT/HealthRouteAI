const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Never run integration writes against the configured application database implicitly.
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a separate PostgreSQL test database.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.JWT_SECRET = 'healthroute-integration-only-secret-32-characters';
process.env.GEMINI_API_KEY = '';
const { pool, initializeDatabase } = require('../dist/database');
const { app } = require('../dist/app');

test('JWT authentication, authorization, and directory CRUD', async t => {
  await initializeDatabase();
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = randomUUID();
  const email = `admin-name-patient-${suffix}@example.test`;
  const password = 'IntegrationPass123!';
  const userIds = [];
  const records = [];
  let patientToken, adminToken, patientId;
  async function request(path, method = 'GET', body, token) {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: response.status, data: await response.json() };
  }
  try {
    await t.test('registration validation, normalization, bcrypt, and patient-only role', async () => {
      assert.equal((await request('/auth/register', 'POST', { name: 'A', email: 'bad', password: 'short' })).status, 400);
      assert.equal((await request('/auth/register', 'POST', { name: 'Test User', email, password, role: 'admin' })).status, 400);
      assert.equal((await request('/auth/register', 'POST', { name: 'Test User', email, password: '😀'.repeat(20) })).status, 400);
      assert.equal((await request('/auth/register', 'POST', { name: 'Test User', email, password: '        ' })).status, 400);
      const result = await request('/auth/register', 'POST', { name: ' Test Patient ', email: email.toUpperCase(), password });
      assert.equal(result.status, 201);
      assert.equal(result.data.user.role, 'patient');
      assert.equal(result.data.user.name, 'Test Patient');
      assert.equal(result.data.user.email, email);
      assert.equal(result.data.user.password_hash, undefined);
      patientId = result.data.user.id; userIds.push(patientId); patientToken = result.data.token;
      const row = (await pool.query('SELECT password_hash FROM users WHERE id=$1', [patientId])).rows[0];
      assert.notEqual(row.password_hash, password);
      assert(await bcrypt.compare(password, row.password_hash));
      assert.equal((await request('/auth/register', 'POST', { name: 'Duplicate', email: email.toUpperCase(), password })).status, 409);
    });
    await t.test('login verifies passwords and returns safe user data', async () => {
      assert.equal((await request('/auth/login', 'POST', { email, password: '   ' })).status, 400);
      assert.equal((await request('/auth/login', 'POST', { email, password: 'wrong' })).status, 401);
      assert.equal((await request('/auth/login', 'POST', { email: `missing-${email}`, password })).status, 401);
      const result = await request('/auth/login', 'POST', { email: email.toUpperCase(), password });
      assert.equal(result.status, 200); assert(result.data.token); assert.equal(result.data.user.password_hash, undefined);
      patientToken = result.data.token;
      const admin = (await pool.query("INSERT INTO users(name,email,password_hash,role) VALUES($1,$2,$3,'admin') RETURNING id", ['Test Admin', `staff-${suffix}@example.test`, await bcrypt.hash(password, 12)])).rows[0];
      userIds.push(admin.id);
      const login = await request('/auth/login', 'POST', { email: `staff-${suffix}@example.test`, password });
      assert.equal(login.status, 200); adminToken = login.data.token;
    });
    await t.test('missing, forged, expired, and wrong-audience tokens rejected', async () => {
      assert.equal((await request('/auth/me')).status, 401);
      assert.equal((await request('/assistant', 'POST', { question: 'Find primary care' })).status, 401);
      assert.equal((await request('/auth/me', 'GET', undefined, patientToken + 'corrupt')).status, 401);
      const payload = jwt.decode(patientToken);
      for (const options of [{ expiresIn: -1, audience: 'healthroute-web' }, { expiresIn: 60, audience: 'another-app' }]) {
        const token = jwt.sign({}, process.env.JWT_SECRET, { subject: patientId, jwtid: payload.jti, issuer: 'healthroute-api', ...options });
        assert.equal((await request('/auth/me', 'GET', undefined, token)).status, 401);
      }
      assert.equal((await request('/auth/me', 'GET', undefined, patientToken)).status, 200);
      assert.equal((await request('/admin/summary', 'GET', undefined, patientToken)).status, 403);
    });
    await t.test('patients search and use the assistant; roles are read from PostgreSQL', async () => {
      assert.equal((await request('/services?q=care', 'GET', undefined, patientToken)).status, 200);
      assert.equal((await request('/assistant', 'POST', { question: 'Find primary care' }, patientToken)).status, 200);
      assert.equal((await request('/assistant', 'POST', { question: ' ' }, patientToken)).status, 400);
      await pool.query("UPDATE users SET role='admin' WHERE id=$1", [patientId]);
      assert.equal((await request('/admin/summary', 'GET', undefined, patientToken)).status, 200);
      await pool.query("UPDATE users SET role='patient' WHERE id=$1", [patientId]);
      assert.equal((await request('/admin/summary', 'GET', undefined, patientToken)).status, 403);
    });
    let departmentId, serviceId, locationId;
    const resources = [
      ['locations', () => ({ name: `Clinic ${suffix}`, address: '1 Test Street', phone: '555-0100', hours: 'Mon-Fri' })],
      ['departments', () => ({ name: `Department ${suffix}`, description: 'Test department', location_ids: [locationId] })],
      ['services', () => ({ name: `Service ${suffix}`, department_id: departmentId, description: 'Test service', appointment_info: 'Call to book', tags: ['integration'] })],
      ['faqs', () => ({ question: `Question ${suffix}?`, answer: 'Test answer' })],
      ['appointment_guidance', () => ({ service_id: serviceId, title: `Guidance ${suffix}`, instructions: 'Bring ID', referral_required: false, booking_url: '/appointments', appointment_recommended: true, how_to_schedule: 'Call the demo clinic', documents_to_bring: ['Photo ID', 'Insurance card'], arrival_guidance: 'Arrive 15 minutes early for check-in', is_demo: true })]
    ];
    for (const [table, body] of resources) {
      await t.test(`${table}: admin CRUD, validation, and patient denial`, async () => {
        const path = `/admin/${table}`;
        assert.equal((await request(path)).status, 401);
        for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
          assert.equal((await request(path + (['PUT', 'PATCH', 'DELETE'].includes(method) ? `/${randomUUID()}` : ''), method, ['POST', 'PUT', 'PATCH'].includes(method) ? {} : undefined, patientToken)).status, 403);
        }
        assert.equal((await request(path, 'POST', {}, adminToken)).status, 400);
        const created = await request(path, 'POST', body(), adminToken);
        assert.equal(created.status, 201, JSON.stringify(created.data));
        const id = created.data.item.id; records.push([table, id]);
        if (table === 'appointment_guidance') {
          assert.equal(created.data.item.appointment_recommended, true);
          assert.deepEqual(created.data.item.documents_to_bring, ['Photo ID', 'Insurance card']);
          assert.equal(created.data.item.how_to_schedule, 'Call the demo clinic');
          assert.equal(created.data.item.is_demo, true);
          assert.equal((await request(`${path}/${created.data.item.id}`, 'PATCH', { appointment_recommended: 'yes' }, adminToken)).status, 400);
        }
        if (table === 'locations') locationId = id;
        if (table === 'departments') departmentId = id;
        if (table === 'services') serviceId = id;
        assert.equal((await request(path, 'GET', undefined, adminToken)).status, 200);
        const update = { ...body() };
        const field = table === 'faqs' ? 'answer' : table === 'appointment_guidance' ? 'instructions' : table === 'locations' ? 'hours' : 'description';
        update[field] = 'Updated content';
        const updated = await request(`${path}/${id}`, 'PUT', update, adminToken);
        assert.equal(updated.status, 200); assert.equal(updated.data.item[field], 'Updated content');
        assert.equal((await request(`${path}/${id}`, 'PATCH', { [field]: 'Patched content' }, adminToken)).status, 200);
        assert.equal((await request(`${path}/${id}`, 'PATCH', { unexpected: true }, adminToken)).status, 400);
        assert.equal((await request(`${path}/invalid-id`, 'DELETE', undefined, adminToken)).status, 400);
        assert.equal((await request(`${path}/${randomUUID()}`, 'PUT', update, adminToken)).status, 404);
        assert.equal((await request(`${path}/${randomUUID()}`, 'DELETE', undefined, adminToken)).status, 404);
      });
    }
    await t.test('foreign keys, duplicate content, booking URLs, and public read consistency', async () => {
      assert.equal((await request('/admin/departments', 'POST', resources[1][1](), adminToken)).status, 409);
      assert.equal((await request('/admin/services', 'POST', { ...resources[2][1](), department_id: randomUUID() }, adminToken)).status, 400);
      for (const booking_url of ['javascript:alert(1)', 'https://', '//outside.example', '/\\outside.example']) {
        assert.equal((await request('/admin/appointment_guidance', 'POST', { ...resources[4][1](), booking_url }, adminToken)).status, 400);
      }
      const services = (await request(`/services?q=${suffix}`)).data.services;
      assert(services.some(s => s.id === serviceId && s.appointmentInfo === 'Call to book' && s.description === 'Patched content'));
      const locations = (await request('/locations')).data.locations;
      assert(locations.find(l => l.id === locationId).services.includes(`Department ${suffix}`));
      assert((await request('/faqs')).data.faqs.some(f => f.answer === 'Patched content'));
      assert((await request('/appointment-guidance')).data.guidance.some(g => g.service_id === serviceId && g.instructions === 'Patched content'));
      const nativeFetch = global.fetch;
      const oldKey = process.env.GEMINI_API_KEY;
      let sawDatabaseContext = false;
      process.env.GEMINI_API_KEY = 'test-provider-key';
      try {
        global.fetch = async (url, options) => {
          if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) return nativeFetch(url, options);
          const payload = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
          const docs = payload.directoryRecords;
          for (const kind of ['department', 'service', 'location', 'faq', 'appointment_guidance']) {
            assert(docs.some(d => d.kind === kind), `Missing PostgreSQL context: ${kind}`);
          }
          assert(docs.some(d => d.id === `service:${serviceId}`));
          assert(docs.some(d => d.id === `location:${locationId}`));
          assert(!JSON.stringify(payload).includes('password_hash'));
          assert(!JSON.stringify(payload).includes('Dermatology'));
          sawDatabaseContext = true;
          return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ answer: 'Contact the listed department to arrange your visit.', sourceIds: [docs[0].id] }) }] } }] }));
        };
        const result = await request('/assistant', 'POST', { question: `Service ${suffix}` }, patientToken);
        assert.equal(result.status, 200);
        assert.equal(result.data.source, 'gemini');
        assert.equal(result.data.answer, 'Contact the listed department to arrange your visit.');
        assert(sawDatabaseContext);
      } finally { global.fetch = nativeFetch; process.env.GEMINI_API_KEY = oldKey; }
      for (const [table, id] of [...records].reverse()) assert.equal((await request(`/admin/${table}/${id}`, 'DELETE', undefined, adminToken)).status, 200);
      assert(!(await request(`/services?q=${suffix}`)).data.services.some(s => s.id === serviceId));
    });
    await t.test('logout revokes the actual JWT session', async () => {
      assert.equal((await request('/auth/logout', 'POST', undefined, patientToken)).status, 200);
      assert.equal((await request('/auth/me', 'GET', undefined, patientToken)).status, 401);
      assert.equal((await request('/assistant', 'POST', { question: 'Find care' }, patientToken)).status, 401);
      const claims = jwt.decode(patientToken);
      assert.equal((await pool.query('SELECT 1 FROM auth_sessions WHERE id=$1', [claims.jti])).rowCount, 0);
    });
    await t.test('sign-in rate limiting returns a friendly error', async () => {
      let result;
      for (let i = 0; i < 31; i++) {
        result = await request('/auth/login', 'POST', { email: 'invalid', password: '' });
        if (result.status === 429) break;
      }
      assert.equal(result.status, 429); assert.match(result.data.error, /Too many sign-in attempts/);
    });
  } finally {
    for (const [table, id] of records.reverse()) await pool.query(`DELETE FROM ${table} WHERE id=$1`, [id]);
    for (const id of userIds) await pool.query('DELETE FROM users WHERE id=$1', [id]);
    await pool.query('DELETE FROM users WHERE email=$1', [email]);
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
