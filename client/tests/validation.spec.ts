import { test, expect } from '@playwright/test';

test('authentication fields reject empty and invalid values without submitting', async ({ page }) => {
  let submissions = 0;
  await page.route('**/api/auth/login', route => { submissions++; return route.fulfill({ status: 401, json: { error: 'Incorrect email or password.' } }); });
  await page.route('**/api/auth/register', route => { submissions++; return route.fulfill({ status: 409, json: { error: 'An account with this email already exists.' } }); });
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog.getByText('Enter your email address.', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Enter your password.', { exact: true })).toBeVisible();
  await expect(dialog.getByLabel('Email address')).toBeFocused();
  await dialog.getByLabel('Email address').fill('invalid');
  await dialog.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(dialog.getByText(/Enter a valid email address/)).toBeVisible();
  await dialog.getByRole('button', { name: /New to HealthRoute/ }).click();
  await dialog.getByLabel('Full name').fill('  ');
  await dialog.getByLabel('Email address').fill('person@example.com');
  await dialog.getByLabel('Password').fill('short');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByText('Use at least 8 characters for your password.')).toBeVisible();
  await dialog.getByLabel('Password').fill('😀'.repeat(19));
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.locator('#auth-password-error')).toContainText('72 UTF-8 bytes');
  expect(submissions).toBe(0);
  await dialog.getByLabel('Full name').fill('Test Patient');
  await dialog.getByLabel('Password').fill('ValidPassword123!');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.locator('#auth-email-error')).toContainText('already exists');
  expect(submissions).toBe(1);
});

test('all admin forms and assistant reject blank input with field errors', async ({ page }) => {
  let mutations = 0;
  await page.addInitScript(() => localStorage.setItem('healthroute_token', `test.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))}.test`));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') { mutations++; return route.fulfill({ status: 500, json: { error: 'Unexpected submission' } }); }
    if (path.endsWith('/auth/me')) return route.fulfill({ json: { user: { id: 'test', name: 'Test Admin', email: 'admin@example.com', role: 'admin' } } });
    if (path.endsWith('/summary')) return route.fulfill({ json: {} });
    return route.fulfill({ json: { items: [], departments: [], locations: [], faqs: [] } });
  });
  await page.goto('/');
  for (const [area, fields] of [
    ['Departments', ['Name', 'Description']],
    ['Services', ['Department', 'Name', 'Description', 'Appointment information']],
    ['Locations', ['Name', 'Address', 'Phone', 'Hours']],
    ['FAQs', ['Question', 'Answer']],
    ['Appointment guidance', ['Service', 'Title', 'Instructions']],
  ] as [string, string[]][]) {
    await page.getByRole('navigation', { name: 'Admin content areas' }).getByRole('button', { name: new RegExp(`^${area}`) }).click();
    await page.getByRole('button', { name: 'Add record' }).click();
    const form = page.locator('.admin-editor');
    await form.getByRole('button', { name: 'Save changes' }).click();
    for (const field of fields) {
      await expect(form.getByLabel(field, { exact: true })).toHaveAttribute('aria-invalid', 'true');
      await expect(form.getByText(`${field} is required.`, { exact: true })).toBeVisible();
    }
    if (area === 'Appointment guidance') {
      await form.getByLabel('Booking URL or site path').fill('https://');
      await form.getByLabel('Documents to bring (one per line)').fill(Array(21).fill('Document').join('\n'));
      await form.getByRole('button', { name: 'Save changes' }).click();
      await expect(form.locator('#error-booking_url')).toBeVisible();
      await expect(form.locator('#error-documents_to_bring')).toBeVisible();
    }
    await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Browse directory' }).click();
  await page.getByLabel('Your navigation question').fill('  ');
  await page.getByRole('button', { name: 'Find my route' }).click();
  await expect(page.locator('#question-error')).toBeVisible();
  await expect(page.getByLabel('Your navigation question')).toBeFocused();
  expect(mutations).toBe(0);
});
