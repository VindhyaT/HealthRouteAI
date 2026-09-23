import { test, expect } from '@playwright/test';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
const serverRequire = createRequire(new URL('../../server/package.json', import.meta.url));
const { Pool } = serverRequire('pg');
const bcrypt = serverRequire('bcryptjs');

// Explicitly select the same local database used by the running API.
if (!process.env.E2E_DATABASE_URL) throw new Error('Set E2E_DATABASE_URL to the local API database.');
const api = process.env.E2E_API_URL || 'http://localhost:4000/api';

test('guest, patient, and administrator authentication end to end', async ({ page, context, request }) => {
  const pool = new Pool({ connectionString: process.env.E2E_DATABASE_URL });
  const email = `browser-patient-${randomUUID()}@example.test`;
  const password = 'BrowserTest123!';
  const tokens: string[] = [];
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let patientToken = '';
  const access = page.getByRole('region', { name: 'Account access' });
  async function signIn(emailAddress: string, pass: string) {
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Email address').fill(emailAddress);
    await dialog.getByLabel('Password').fill(pass);
    await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(dialog).toBeHidden();
    const token = await page.evaluate(() => localStorage.getItem('healthroute_token'));
    if (token) tokens.push(token);
    return token!;
  }
  try {
    await test.step('guest sees public directory, locked assistant, and no admin console', async () => {
      await page.goto('/');
      await expect(access).toContainText('Guest access');
      await expect(page.locator('.department-card').first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Admin console' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Sign in to use the assistant' })).toBeVisible();
      expect((await request.get(`${api}/admin/summary`)).status()).toBe(401);
      expect((await request.post(`${api}/assistant`, { data: { question: 'Find care' } })).status()).toBe(401);
    });
    await test.step('patient registration works in the browser and stores only a bcrypt hash', async () => {
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'New to HealthRoute? Create an account' }).click();
      await dialog.getByLabel('Full name').fill('Browser Patient');
      await dialog.getByLabel('Email address').fill(email);
      await dialog.getByLabel('Password').fill(password);
      await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
      await expect(dialog).toBeHidden();
      await expect(access).toContainText('Patient workspace');
      await expect(page.getByLabel('Your navigation question')).toBeVisible();
      const result = await pool.query('SELECT password_hash,role FROM users WHERE email=$1', [email]);
      expect(result.rowCount).toBe(1);
      expect(result.rows[0].role).toBe('patient');
      expect(result.rows[0].password_hash).toMatch(/^\$2[aby]\$12\$/);
      expect(await bcrypt.compare(password, result.rows[0].password_hash)).toBe(true);
      const columns = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users'");
      expect(columns.rows.map((row: { column_name: string }) => row.column_name)).not.toContain('password');
      const invalidHashes = await pool.query("SELECT count(*)::int AS count FROM users WHERE password_hash !~ '^\\$2[aby]\\$[0-9]{2}\\$[./A-Za-z0-9]{53}$'");
      expect(invalidHashes.rows[0].count).toBe(0);
      tokens.push((await page.evaluate(() => localStorage.getItem('healthroute_token')))!);
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(access).toContainText('Guest access');
    });
    await test.step('patient login, refresh, protected routes, and role escalation rejection', async () => {
      patientToken = await signIn(email, password);
      await expect(access).toContainText('Patient workspace');
      await page.reload();
      await expect(access).toContainText('Patient workspace');
      await expect(page.getByRole('button', { name: 'Admin console' })).toHaveCount(0);
      const headers = { Authorization: `Bearer ${patientToken}` };
      const me = await request.get(`${api}/auth/me`, { headers });
      expect(me.status()).toBe(200);
      expect((await me.json()).user.password_hash).toBeUndefined();
      for (const resource of ['summary', 'departments', 'services', 'locations', 'faqs', 'appointment_guidance']) {
        expect((await request.get(`${api}/admin/${resource}`, { headers })).status()).toBe(403);
      }
      expect((await request.post(`${api}/admin/departments`, { headers, data: { name: 'Unauthorized', description: 'Must not be saved' } })).status()).toBe(403);
      await page.evaluate(() => localStorage.setItem('healthroute_user', JSON.stringify({ role: 'admin', name: 'Forged admin' })));
      await page.reload();
      await expect(access).toContainText('Patient workspace');
      await expect(page.getByRole('button', { name: 'Admin console' })).toHaveCount(0);
    });
    await test.step('logout revokes JWT and synchronizes another browser tab', async () => {
      const other = await context.newPage();
      await other.goto('/');
      await expect(other.getByRole('region', { name: 'Account access' })).toContainText('Patient workspace');
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(access).toContainText('Guest access');
      await expect(other.getByRole('region', { name: 'Account access' })).toContainText('Guest access');
      await other.close();
      expect((await request.get(`${api}/auth/me`, { headers: { Authorization: `Bearer ${patientToken}` } })).status()).toBe(401);
    });
    await test.step('admin login opens management automatically and persists on reload', async () => {
      const token = await signIn(process.env.E2E_ADMIN_EMAIL || 'admin@healthroute.local', process.env.E2E_ADMIN_PASSWORD || 'DemoPass123!');
      await expect(access).toContainText('Administrator workspace');
      await expect(page.getByRole('heading', { name: 'Directory workspace' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add record' })).toBeVisible();
      expect((await request.get(`${api}/admin/summary`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
      await page.reload();
      await expect(page.getByRole('heading', { name: 'Directory workspace' })).toBeVisible();
      await page.getByRole('button', { name: 'Browse directory' }).click();
      await expect(page.getByRole('button', { name: 'Admin console' })).toBeVisible();
      await page.getByRole('button', { name: 'Sign out', exact: true }).click();
      await expect(access).toContainText('Guest access');
      expect(errors).toEqual([]);
    });
  } finally {
    for (const token of tokens) await request.post(`${api}/auth/logout`, { headers: { Authorization: `Bearer ${token}` } });
    await pool.query('DELETE FROM users WHERE email=$1', [email]);
    await pool.end();
  }
});
