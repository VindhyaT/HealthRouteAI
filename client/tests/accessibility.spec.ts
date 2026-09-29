import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', route => route.fulfill({ json: { departments: [], locations: [], faqs: [] } }));
});

test('keyboard navigation, password guidance, errors and mobile menu focus', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to main content' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Email address')).toBeFocused();
  for (let i=0;i<8;i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await dialog.getByRole('button', { name: /New to HealthRoute/ }).click();
  await expect(dialog.getByLabel('Password')).toHaveAttribute('aria-describedby', 'password-hint');
  await dialog.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(dialog.getByLabel('Full name')).toBeFocused();
  await expect(dialog.getByLabel('Password')).toHaveAttribute('aria-describedby', 'auth-password-error password-hint');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeFocused();
  await page.setViewportSize({ width:320,height:844 });
  const menu = page.getByRole('button', { name: 'Menu', exact:true });
  await menu.click();
  await page.getByRole('navigation', { name:'Primary navigation' }).getByRole('link').first().focus();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAttribute('aria-expanded','false');
  expect(await menu.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
});

test('admin record buttons identify targets and delete dialog supports keyboard cancellation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('healthroute_token', `test.${btoa(JSON.stringify({ exp: Date.now()/1000 + 3600 }))}.test`));
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith('/auth/me')) return route.fulfill({ json:{ user:{id:'admin',name:'Admin',role:'admin'} } });
    if (path.endsWith('/summary')) return route.fulfill({json:{departments:1}});
    return route.fulfill({json:{items:[{id:'department',name:'Cardiology',description:'Heart services',icon:'heart-pulse'}]}});
  });
  await page.goto('/');
  const trigger = page.getByRole('button',{name:'Delete Cardiology',exact:true});
  await trigger.click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toHaveAccessibleName('Delete this record?');
  await expect(dialog.getByRole('button',{name:'Cancel',exact:true})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await page.getByRole('button',{name:'Edit Cardiology',exact:true}).click();
  await expect(page.getByLabel('Name',{exact:true})).toBeFocused();
  await expect(page.getByLabel('Search admin records')).toBeVisible();
});
