const { test } = require('node:test');
const assert = require('node:assert/strict');
// Explicit demo catalog exercises the no-database matching path as well.
process.env.DATABASE_URL = '';
const { answerNavigationQuestion } = require('../dist/controllers/assistantController');
const { matchHealthcareServices } = require('../dist/services/serviceMatching');

async function answer(question) {
  let body;
  await answerNavigationQuestion({ body: { question } }, { json(value) { body = value; } }, error => { throw error; });
  return body;
}
test('local matching supplies all recommendation fields for common phrases', async () => {
  for (const [query, expected] of [['heart doctor', 'Cardiology'], ['X-ray', 'Radiology'], ['skin doctor', 'Dermatology'], ['blood test', 'Laboratory Services'], ['rehab', 'Physical Therapy'], ['bone doctor', 'Orthopedics'], ['I need a bone doctor', 'Orthopedics']]) {
    const [result] = await matchHealthcareServices(query);
    assert.equal(result.department.name, expected);
    assert(result.service.name);
    assert(result.locations.length);
    assert(result.locations.every(l => l.name && l.address && l.phone && l.hours));
    assert(result.appointmentGuidance.every(g => g.instructions && g.how_to_schedule && g.arrival_guidance && g.documents_to_bring.length && g.is_demo));
    assert.equal(result.appointmentGuidance[0].appointment_recommended, true);
    assert(!JSON.stringify(result.appointmentGuidance).includes('Fasting'));
  }
});
test('Gemini failure modes preserve complete local recommendations', async t => {
  const originalFetch = global.fetch;
  const originalKey = process.env.GEMINI_API_KEY;
  try {
    await t.test('missing API key skips the network', async () => {
      process.env.GEMINI_API_KEY = '';
      global.fetch = async () => { throw new Error('Network must not be used'); };
      const result = await answer('bone doctor');
      assert.equal(result.source, 'local');
      assert.equal(result.recommendations[0].department.name, 'Orthopedics');
    });
    process.env.GEMINI_API_KEY = 'test-only-key';
    const failures = [
      ['network failure', async () => { throw new TypeError('network unavailable'); }],
      ['provider unavailable', async () => new Response('', { status: 503 })],
      ['rate limited', async () => new Response('', { status: 429 })],
      ['invalid JSON', async () => new Response('not json')],
      ['empty response', async () => new Response('{}')],
      ['blocked response', async () => new Response(JSON.stringify({ candidates: [{ finishReason: 'SAFETY' }] }))],
      ['request timeout', async (_url, options) => new Promise((_, reject) => {
        const keepAlive = setTimeout(() => reject(new Error('timeout did not fire')), 6000);
        options.signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(options.signal.reason); }, { once: true });
      })]
    ];
    for (const [name, implementation] of failures) await t.test(name, async () => {
      global.fetch = implementation;
      const result = await answer('rehab');
      assert.equal(result.source, 'local');
      assert.equal(result.recommendations[0].department.name, 'Physical Therapy');
      assert(result.recommendations[0].locations[0].phone);
      assert(result.recommendations[0].appointmentGuidance[0].instructions);
    });
    await t.test('provider prose cannot replace verified contact details', async () => {
      global.fetch = async (_url, options) => {
        const context = JSON.parse(JSON.parse(options.body).contents[0].parts[0].text);
        return new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify({ answer: 'You can contact Cardiology for a heart specialist appointment.', sourceIds: [context.directoryRecords[0].id] }) }] } }] }));
      };
      const result = await answer('heart doctor');
      assert.equal(result.source, 'gemini');
      assert.equal(result.answer, 'You can contact Cardiology for a heart specialist appointment.');
      assert.equal(result.recommendations[0].department.name, 'Cardiology');
      assert.equal(result.recommendations[0].locations[0].phone, '(555) 010-4200');
    });
    await t.test('unknown requests do not invent a match or call Gemini', async () => {
      global.fetch = async () => { assert.fail('No provider call for unmatched request'); };
      const result = await answer('unrecognizedzzzz');
      assert.deepEqual(result.recommendations, []);
      assert.match(result.answer, /No matching service/);
    });
  } finally {
    global.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey;
  }
});
