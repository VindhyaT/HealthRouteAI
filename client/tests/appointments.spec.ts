import { test, expect } from '@playwright/test';

test('service appointment guidance displays administrative details and disclaimer', async ({ page, request }) => {
  await page.goto('/#directory');
  const directory = page.locator('#directory');
  for (const [term, department, service, recommended] of [
    ['blood test', 'Laboratory Services', 'Laboratory testing', true],
    ['urgent care', 'Urgent Care', 'Urgent care visit', false]
  ] as const) {
    await directory.getByRole('button', { name: term, exact: true }).click();
    const card = directory.locator('.department-card').first();
    await expect(card.getByRole('heading', { level: 3 })).toHaveText(department);
    await card.locator('summary').filter({ hasText: service }).click();
    const guidance = card.locator('.appointment-guidance-panel');
    await expect(guidance).toBeVisible();
    await expect(guidance.getByText(/Demo administrative information/)).toBeVisible();
    await expect(guidance.locator('dt').filter({ hasText: 'Appointment recommended' }).locator('+ dd')).toContainText(recommended ? 'Yes' : 'No');
    for (const label of ['How to schedule', 'General documents to bring', 'Arrival guidance']) await expect(guidance.getByText(label, { exact: true })).toBeVisible();
    await expect(guidance.getByText('Photo ID', { exact: true })).toBeVisible();
    await expect(guidance.locator('a[href^="tel:"]').first()).toBeVisible();
    await expect(guidance.getByText(/Hours:/).first()).toBeVisible();
    await expect(guidance.getByText('HealthRoute AI provides healthcare navigation information, not medical advice.')).toBeVisible();
    await expect(guidance).not.toContainText(/fasting|empty stomach|stop taking/i);
  }
  const response = await request.get(`${process.env.E2E_API_URL || 'http://localhost:4000/api'}/services?q=blood%20test`);
  const service = (await response.json()).services[0];
  expect(service.appointmentGuidance[0].appointment_recommended).toBe(true);
  expect(service.appointmentGuidance[0].documents_to_bring).toContain('Photo ID');
});
