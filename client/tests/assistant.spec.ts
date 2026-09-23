import { test, expect } from '@playwright/test';

test('assistant shows department, service, contact details, and guidance', async ({ page, request }) => {
  test.setTimeout(60000);
  const api = process.env.E2E_API_URL || 'http://localhost:4000/api';
  const login = await request.post(`${api}/auth/login`, { data: { email: 'patient@healthroute.local', password: 'DemoPass123!' } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  try {
    await page.addInitScript(token => localStorage.setItem('healthroute_token', token), token);
    await page.goto('/#assistant');
    const assistant = page.locator('#assistant');
    for (const [query, department] of [['heart doctor', 'Cardiology'], ['X-ray', 'Radiology'], ['skin doctor', 'Dermatology'], ['blood test', 'Laboratory Services'], ['rehab', 'Physical Therapy'], ['bone doctor', 'Orthopedics']]) {
      await assistant.getByLabel('Your navigation question').fill(query);
      await assistant.getByRole('button', { name: 'Find my route', exact: true }).click();
      const result = assistant.locator('.recommendation-card').first();
      await expect(result.getByRole('heading', { level: 3 })).toHaveText(department, { timeout: 10000 });
      await expect(result.locator('h4').first()).not.toBeEmpty();
      await expect(result.locator('.recommendation-location').first()).toBeVisible();
      await expect(result.locator('a[href^="tel:"]').first()).toBeVisible();
      await expect(result.locator('.recommendation-hours').first()).not.toBeEmpty();
      await expect(result.getByRole('heading', { name: 'Appointment guidance' })).toBeVisible();
      await expect(result.locator('.guidance-title').first()).not.toBeEmpty();
    }
    await assistant.getByLabel('Your navigation question').fill('unknownzzzzz');
    await assistant.getByRole('button', { name: 'Find my route', exact: true }).click();
    await expect(assistant.getByText(/No matching service was found/)).toBeVisible();
    await expect(assistant.locator('.recommendation-card')).toHaveCount(0);
  } finally { await request.post(`${api}/auth/logout`, { headers: { Authorization: `Bearer ${token}` } }); }
});

test('assistant displays generated responses, FAQ answers, safety refusals, and retryable failures', async ({ page, request }) => {
  const api = process.env.E2E_API_URL || 'http://localhost:4000/api';
  const login = await request.post(`${api}/auth/login`, { data: { email: 'patient@healthroute.local', password: 'DemoPass123!' } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  try {
    await page.addInitScript(token => localStorage.setItem('healthroute_token', token), token);
    await page.goto('/#assistant');
    const assistant = page.locator('#assistant');
    // Provider-success presentation is deterministic without sending real patient questions externally.
    await page.route('**/api/assistant', async route => {
      await new Promise(resolve => setTimeout(resolve, 500));
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ answer: 'Radiology can help you arrange an X-ray at Main Campus.', source: 'gemini', recommendations: [], sources: [{ id: 'service:test', kind: 'service', title: 'Diagnostic imaging' }], disclaimer: 'Navigation guidance only.' }) });
    });
    await assistant.getByLabel('Your navigation question').fill('Where can I get an X-ray?');
    await assistant.getByRole('button', { name: 'Find my route', exact: true }).click();
    await expect(assistant.getByRole('status')).toContainText('Looking up directory');
    await expect(assistant.getByText('Radiology can help you arrange an X-ray at Main Campus.')).toBeVisible();
    await assistant.getByText('Directory sources', { exact: true }).click();
    await expect(assistant.getByText('Diagnostic imaging', { exact: true })).toBeVisible();
    await page.unroute('**/api/assistant');
    await assistant.getByLabel('Your navigation question').fill('What should I bring to an appointment?');
    await assistant.getByRole('button', { name: 'Find my route', exact: true }).click();
    await expect(assistant.locator('.matching-intro')).toContainText('photo ID');
    await assistant.getByLabel('Your navigation question').fill('Which medication should I take?');
    await assistant.getByRole('button', { name: 'Find my route', exact: true }).click();
    await expect(assistant.locator('.matching-intro')).toContainText('cannot diagnose');
    await page.route('**/api/assistant', route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'We could not complete your request.' }) }));
    await assistant.getByLabel('Your navigation question').fill('X-ray');
    await assistant.getByRole('button', { name: 'Find my route', exact: true }).click();
    await expect(assistant.getByRole('alert')).toContainText('Please try again');
    await page.unroute('**/api/assistant');
    await assistant.getByRole('button', { name: 'Find my route', exact: true }).click();
    await expect(assistant.locator('.recommendation-card').first().getByRole('heading', { level: 3 })).toHaveText('Radiology');
  } finally { await request.post(`${api}/auth/logout`, { headers: { Authorization: `Bearer ${token}` } }); }
});
