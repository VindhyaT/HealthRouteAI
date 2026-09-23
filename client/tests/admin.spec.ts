import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

test('admin dashboard CRUD, validation, confirmation, error recovery, and mobile layout', async ({ page, request }) => {
  test.setTimeout(60000);
  page.setDefaultTimeout(10000);
  const api = process.env.E2E_API_URL || 'http://localhost:4000/api';
  if (api !== 'http://localhost:4000/api') {
    await page.route('http://localhost:4000/api/**', async route => {
      const response = await route.fetch({ url: route.request().url().replace('http://localhost:4000/api', api) });
      await route.fulfill({ response });
    });
  }
  const login = await request.post(`${api}/auth/login`, { data: { email: 'admin@healthroute.local', password: 'DemoPass123!' } });
  expect(login.status()).toBe(200);
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}` };
  const suffix = randomUUID().slice(0, 8);
  const cleanup: [string, string][] = [];
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.addInitScript(token => localStorage.setItem('healthroute_token', token), token);
    await page.route('**/api/admin/summary', async route => { await new Promise(resolve => setTimeout(resolve, 600)); await route.fallback(); });
    await page.goto('/');
    await expect(page.getByText('Loading departments...', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Directory workspace' })).toBeVisible();
    await expect(page.locator('.dashboard-stat')).toHaveCount(5);
    await expect(page.getByRole('button', { name: 'Add record', exact: true })).toBeVisible();
    await page.unroute('**/api/admin/summary');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.screenshot({ path: '/private/tmp/healthroute-admin.png' });
    const resources = [
      { key: 'departments', label: 'Departments', title: 'Name', fields: { Description: 'Demo department description' } },
      { key: 'services', label: 'Services', title: 'Name', fields: { Description: 'Demo service description', 'Appointment information': 'Call the clinic to schedule' } },
      { key: 'locations', label: 'Locations', title: 'Name', fields: { Address: '10 Demo Street', Phone: '555-0100', Hours: 'Monday to Friday, 9 AM to 5 PM' } },
      { key: 'faqs', label: 'FAQs', title: 'Question', fields: { Answer: 'Contact reception for help' } },
      { key: 'appointment_guidance', label: 'Appointment guidance', title: 'Title', fields: { Instructions: 'Bring your appointment confirmation' } }
    ];
    for (const resource of resources) await test.step(`${resource.label}: add, edit, cancel deletion, confirm deletion`, async () => {
      await page.getByRole('navigation', { name: 'Admin content areas' }).getByRole('button', { name: new RegExp(`^${resource.label}`) }).click();
      await page.getByRole('button', { name: 'Add record', exact: true }).click();
      const form = page.locator('.admin-editor');
      const title = `Browser ${resource.label} ${suffix}`;
      await form.getByLabel(resource.title, { exact: true }).fill(title);
      for (const [label, value] of Object.entries(resource.fields)) await form.getByLabel(label, { exact: true }).fill(value!);
      if (resource.key === 'services') await form.getByLabel('Department', { exact: true }).selectOption({ index: 1 });
      if (resource.key === 'appointment_guidance') await form.getByLabel('Service', { exact: true }).selectOption({ index: 1 });
      if (resource.key === 'departments') {
        await form.getByLabel('Name', { exact: true }).fill('   ');
        await form.getByRole('button', { name: 'Save changes' }).click();
        await expect(form.getByText('Name is required.', { exact: true })).toBeVisible();
        await form.getByLabel('Name', { exact: true }).fill(title);
      }
      if (resource.key === 'faqs') {
        await page.route('**/api/admin/faqs', async route => {
          if (route.request().method() === 'POST') await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Temporary save failure. Please retry.' }) });
          else await route.fallback();
        });
        await form.getByRole('button', { name: 'Save changes' }).click();
        await expect(page.getByRole('alert')).toContainText('Temporary save failure');
        await expect(form.getByLabel('Question', { exact: true })).toHaveValue(title);
        await page.unroute('**/api/admin/faqs');
      }
      await form.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.locator('.success-message')).toContainText('Record created.');
      const rows = await (await request.get(`${api}/admin/${resource.key}`, { headers })).json();
      const added = rows.items.find((item: Record<string, string>) => [item.name, item.title, item.question].includes(title));
      expect(added).toBeTruthy(); cleanup.push([resource.key, added.id]);
      await page.getByLabel('Search admin records').fill(title);
      const record = page.locator('.admin-record').filter({ hasText: title });
      await expect(record).toHaveCount(1);
      await record.getByRole('button', { name: 'Edit', exact: true }).click();
      const firstField = Object.keys(resource.fields)[0];
      await form.getByLabel(firstField, { exact: true }).fill('Updated administrative content');
      await form.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.locator('.success-message')).toContainText('Changes saved.');
      await expect(record).toContainText('Updated administrative content');
      await record.getByRole('button', { name: 'Delete', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Delete this record?' });
      await expect(dialog).toContainText(title);
      await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(record).toHaveCount(1);
      await record.getByRole('button', { name: 'Delete', exact: true }).click();
      if (resource.key === 'departments') await expect(dialog).toContainText('Its services, appointment guidance');
      await dialog.getByRole('button', { name: 'Delete record', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(page.locator('.success-message')).toContainText('Record deleted.');
      await expect(record).toHaveCount(0);
      await page.getByLabel('Search admin records').fill('');
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('navigation', { name: 'Admin content areas' }).getByRole('button', { name: /^Departments/ }).click();
    await page.getByRole('button', { name: 'Add record', exact: true }).click();
    await expect(page.locator('.admin-editor')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.admin-editor').getByRole('button', { name: 'Cancel', exact: true }).click();
    expect(errors).toEqual([]);
  } finally {
    for (const [resource, id] of cleanup.reverse()) await request.delete(`${api}/admin/${resource}/${id}`, { headers });
    await request.post(`${api}/auth/logout`, { headers });
  }
});
