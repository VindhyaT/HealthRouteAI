import { test, expect } from '@playwright/test';

test('desktop and mobile layout, keyboard navigation, and accessible sign-in dialog', async ({ page }) => {
  const browserErrors: string[] = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') browserErrors.push(message.text()); });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/');
  await expect(page).toHaveTitle('HealthRoute AI — Healthcare navigation');
  await expect(page.getByRole('heading', { name: /The right care starts/ })).toBeVisible();
  await expect(page.locator('.department-card').first()).toBeVisible();
  await page.screenshot({ path: '/private/tmp/healthroute-desktop.png' });
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Account access' });
  await expect(dialog.getByLabel('Email address')).toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeFocused();
  for (const width of [768, 390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Menu', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('link', { name: 'Find care', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Menu', exact: true })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByLabel('What service are you looking for?')).toBeInViewport();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.department-card').first()).toBeVisible();
  await page.screenshot({ path: '/private/tmp/healthroute-mobile.png', fullPage: true });
  expect(browserErrors).toEqual([]);
});

test('locations and FAQs have independent error, loading, retry, and empty states', async ({ page }) => {
  let failed = true;
  await page.route('**/api/locations', async route => {
    await new Promise(resolve => setTimeout(resolve, 500));
    await route.fulfill({ status: failed ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failed ? { error: 'Please try again.' } : { locations: [] }) });
  });
  await page.route('**/api/faqs', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ faqs: [] }) }));
  await page.goto('/#locations');
  await expect(page.locator('#locations').getByRole('status')).toContainText('Loading locations');
  await expect(page.locator('#locations').getByRole('alert')).toContainText('Locations are unavailable');
  await expect(page.locator('#faqs')).toContainText('No questions published yet');
  await expect(page.locator('.department-card').first()).toBeVisible();
  failed = false;
  await page.locator('#locations').getByRole('button', { name: 'Try again' }).click();
  await expect(page.locator('#locations')).toContainText('No locations published yet');
  await page.unroute('**/api/locations');
  await page.unroute('**/api/faqs');
});
