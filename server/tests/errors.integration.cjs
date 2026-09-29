const { test } = require('node:test');
const assert = require('node:assert/strict');
if (!process.env.TEST_DATABASE_URL) throw new Error('Set TEST_DATABASE_URL to a separate test database.');
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
const { pool } = require('../dist/database');
const { app } = require('../dist/app');

test('database failures return safe errors and idle errors do not crash', async () => {
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const original = pool.query;
  try {
    for (const code of ['ECONNREFUSED', '57P01', '57014', 'XX000']) {
      pool.query = async () => { throw Object.assign(new Error('private SQL and credentials'), { code }); };
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/locations`);
      assert.equal(response.status, code === 'XX000' ? 500 : 503);
      const data = await response.json();
      assert.equal(typeof data.error, 'string');
      assert(!JSON.stringify(data).includes('private'));
      assert(!JSON.stringify(data).includes(code));
    }
    assert.doesNotThrow(() => pool.emit('error', new Error('private connection details')));
  } finally {
    pool.query = original;
    await new Promise(resolve => server.close(resolve));
    await pool.end();
  }
});
