import { test, expect } from '@playwright/test';

test('directory cards, relevant searches, and empty results', async ({ page, request }) => {
  await page.goto('/#directory');
  const directory = page.locator('#directory');
  const cards = directory.locator('.department-card');
  await expect(cards.first()).toBeVisible();
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(8);
  for (const card of await cards.all()) {
    await expect(card.getByRole('heading', { level: 3 })).toBeVisible();
    await expect(card.locator('.department-description')).not.toBeEmpty();
    await expect(card.getByRole('heading', { name: /Available services/ })).toBeVisible();
    await expect(card.locator('.department-location').first()).toBeVisible();
    await expect(card.locator('.department-location a[href^="tel:"]').first()).toBeVisible();
    await expect(card.locator('.department-hours').first()).not.toBeEmpty();
  }
  for (const [query, department] of [['X-ray', 'Radiology'], ['heart doctor', 'Cardiology'], ['physical therapy', 'Physical Therapy'], ['blood test', 'Laboratory Services'], ['skin doctor', 'Dermatology'], ['urgent care', 'Urgent Care']]) {
    await directory.getByRole('button', { name: query, exact: true }).click();
    await expect(cards.first().getByRole('heading', { level: 3 })).toHaveText(department);
    await expect(cards.first().getByText('Top match', { exact: true })).toBeVisible();
    const response = await request.get(`${process.env.E2E_API_URL || 'http://localhost:4000/api'}/services?q=${encodeURIComponent(query)}`);
    expect(response.status()).toBe(200);
    expect((await response.json()).services[0].department).toBe(department);
  }
  await directory.getByLabel('What service are you looking for?').fill('nonexistentzzzz');
  await expect(directory.getByText('No matching departments found')).toBeVisible();
  await expect(cards).toHaveCount(0);
  await directory.getByRole('button', { name: 'View all departments' }).click();
  await expect(cards).toHaveCount(count);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(cards.first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await directory.scrollIntoViewIfNeeded();
  await page.screenshot({ path: '/private/tmp/healthroute-directory.png' });
});

test('directory loading, error retry, and unconfigured empty state', async ({ page }) => {
  let fail = true;
  await page.route('**/api/departments?*', async route => {
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill({ status: fail ? 503 : 200, contentType: 'application/json', body: JSON.stringify(fail ? { error: 'Please try again shortly.' } : { departments: [] }) });
  });
  await page.goto('/#directory');
  const directory = page.locator('#directory');
  await expect(directory.getByRole('status')).toHaveText('Finding departments...');
  await expect(directory.getByRole('alert')).toContainText('We couldn’t load the directory.');
  fail = false;
  await directory.getByRole('button', { name: 'Try again' }).click();
  await expect(directory.getByText('The directory is being updated')).toBeVisible();
  await page.unroute('**/api/departments?*');
  await directory.getByRole('button', { name: 'Refresh directory' }).click();
  await expect(directory.locator('.department-card').first()).toBeVisible();
});
