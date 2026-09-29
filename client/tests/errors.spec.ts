import { test, expect } from '@playwright/test';

for (const failure of ['network', 'html', 'missing', 'server']) {
  test(`directory safely handles ${failure} and retries`, async ({ page }) => {
    let fail = true;
    await page.route('**/api/departments?*', route => {
      if (!fail) return route.fulfill({ json: { departments: [] } });
      if (failure === 'network') return route.abort('failed');
      if (failure === 'html') return route.fulfill({ contentType: 'text/html', body: '<html>internal upstream failure</html>' });
      if (failure === 'server') return route.fulfill({ status: 500, json: { error: 'secret database password and SQL details' } });
      return route.fulfill({ json: {} });
    });
    await page.goto('/');
    const section = page.locator('#directory');
    await expect(section.getByRole('alert')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('secret database password');
    await expect(page.locator('body')).not.toContainText('internal upstream failure');
    fail = false;
    await section.getByRole('button', { name: 'Try again' }).click();
    await expect(section.getByText('The directory is being updated')).toBeVisible();
  });
}

test('unexpected nested data shows a recovery screen instead of a blank app', async ({ page }) => {
  await page.route('**/api/departments?*', route => route.fulfill({ json: { departments: [null] } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'We couldn’t display this page.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload application' })).toBeVisible();
});
