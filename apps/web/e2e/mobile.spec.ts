import { expect, test } from '@playwright/test';

test('fits a phone screen without sideways scrolling', async ({ page }) => {
  for (const path of [
    '/',
    '/plan/state',
    '/plan/terminal',
    '/plan/agent',
    '/review',
    '/sign',
    '/export',
    '/privacy',
  ]) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});

test('the first question is usable on a phone', async ({ page }) => {
  await page.goto('/plan/state');
  await page.getByTestId('state-filter').fill('Ohio');
  await page.getByRole('radio', { name: 'Ohio' }).check();
  await page.getByTestId('next').click();
  await page.waitForURL('**/plan/name');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('What is your full legal name?');
});
