const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateRuntimeConfig } = require('../dist/runtimeConfig');
test('production refuses missing database, invalid origin, port and proxy settings', () => {
  const keys = ['NODE_ENV', 'DATABASE_URL', 'CLIENT_URL', 'PORT', 'TRUST_PROXY'];
  const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  try {
    Object.assign(process.env, { NODE_ENV: 'production', DATABASE_URL: 'postgresql://example/db', CLIENT_URL: 'https://health.example', PORT: '4000', TRUST_PROXY: '1' });
    assert.equal(validateRuntimeConfig(), 4000);
    for (const [key, value] of [['DATABASE_URL', ''], ['DATABASE_URL', 'https://example'], ['CLIENT_URL', 'http://example'], ['CLIENT_URL', 'https://example/path'], ['PORT', 'abc'], ['PORT', '65536'], ['TRUST_PROXY', 'true']]) {
      const previous = process.env[key]; process.env[key] = value;
      assert.throws(validateRuntimeConfig); process.env[key] = previous;
    }
  } finally { for (const key of keys) original[key] === undefined ? delete process.env[key] : process.env[key] = original[key]; }
});
