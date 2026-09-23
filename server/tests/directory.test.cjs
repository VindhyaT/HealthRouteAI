const { test } = require('node:test');
const assert = require('node:assert/strict');
const { rankServices, relevance } = require('../dist/services/directorySearch');
const { departments } = require('../dist/database/demoData');
const services = departments.flatMap(d => d.services);
for (const [query, expected] of [['X-ray', 'Radiology'], ['x ray', 'Radiology'], ['XRAY', 'Radiology'], ['heart doctor', 'Cardiology'], ['physical therapy', 'Physical Therapy'], ['blood test', 'Laboratory Services'], ['skin doctor', 'Dermatology'], ['urgent care', 'Urgent Care'], ['I need a heart doctor', 'Cardiology']]) {
  test(`search ranks ${query} in ${expected}`, () => assert.equal(rankServices(services, query)[0]?.department, expected));
}
test('unknown and punctuation-only queries do not return unrelated services', () => {
  assert.deepEqual(rankServices(services, 'nonexistentzz'), []);
  assert.deepEqual(rankServices(services, '%_'), []);
});
test('blank search returns every service and exact names outrank descriptions', () => {
  assert.equal(rankServices(services, '  ').length, services.length);
  assert(relevance('urgent care', 'Urgent Care') > relevance('urgent care', 'Other', 'Ask about urgent care'));
});

test('canonical department wins over legacy department names for the same service', () => {
  const cardiology = services.find(s => s.name === 'Cardiology consultation');
  const legacy = { ...cardiology, department: 'Heart & Vascular' };
  assert.equal(rankServices([legacy, cardiology], 'heart doctor')[0].department, 'Cardiology');
});

test('rehab prefers Physical Therapy even when a legacy Rehabilitation service exists', () => {
  const therapy = services.find(s => s.department === 'Physical Therapy');
  assert.equal(rankServices([{ ...therapy, department: 'Rehabilitation' }, therapy], 'rehab')[0].department, 'Physical Therapy');
});
