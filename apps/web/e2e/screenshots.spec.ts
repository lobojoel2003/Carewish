/**
 * Regenerates the README screenshots in docs/images.
 *   pnpm build && SCREENSHOTS=1 pnpm --filter @carewish/web exec playwright test e2e/screenshots.spec.ts --project=desktop
 */
import { join } from 'node:path';
import { devices, expect, test } from '@playwright/test';
import { completeWizard } from './helpers';

test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to regenerate README images');

const OUT = join(import.meta.dirname, '..', '..', '..', 'docs', 'images');
const desktop = { viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2 };

test('README screenshots', async ({ browser }) => {
  test.setTimeout(180_000);
  const context = await browser.newContext(desktop);
  const page = await context.newPage();

  await page.goto('/');
  await page.screenshot({ path: join(OUT, 'landing.png') });

  await completeWizard(page, {
    state: 'California',
    name: 'Maria Elena Torres',
    agent: { name: 'Daniel Torres', phone: '(559) 555-0142', relationship: 'child' },
    alternate: { name: 'Lucía Torres', phone: '(559) 555-0199' },
  });

  await page.goto('/plan/terminal');
  await expect(page.getByRole('radio', { checked: true })).toBeVisible();
  await page.screenshot({ path: join(OUT, 'question.png') });

  await page.goto('/review');
  await page.screenshot({ path: join(OUT, 'review.png') });

  await page.goto('/sign');
  await page.getByTestId('witness-name-0').fill('Daniel Torres');
  await page.getByTestId('witness-name-1').fill('Ana Ruiz');
  await page.getByLabel('How is this person related to you?').nth(1).selectOption('sibling');
  const checker = page.getByTestId('witness-checker');
  await expect(checker).toContainText("Can't be a witness");
  await checker.screenshot({ path: join(OUT, 'witness-checker.png') });
  await page
    .getByTestId('sign-document')
    .first()
    .screenshot({ path: join(OUT, 'signing-checklist.png') });

  await page.goto('/export');
  await expect(page.getByTestId('wallet-card')).toBeVisible();
  await page
    .getByRole('region', { name: 'Wallet card' })
    .screenshot({ path: join(OUT, 'wallet-card.png') });
  await page.screenshot({ path: join(OUT, 'export.png') });

  await page.getByRole('button', { name: 'Español' }).click();
  await page.goto('/plan/agent');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('¿Quién debe tomar');
  await page.screenshot({ path: join(OUT, 'spanish.png') });
  await context.close();

  const dark = await browser.newContext({ ...desktop, colorScheme: 'dark' });
  const darkPage = await dark.newPage();
  await darkPage.goto('/plan/values');
  await darkPage.getByRole('checkbox', { name: 'Being at home' }).check();
  await darkPage.getByRole('checkbox', { name: 'Having the people I love nearby' }).check();
  await darkPage.screenshot({ path: join(OUT, 'dark.png') });
  await dark.close();

  const phone = await browser.newContext({ ...devices['iPhone 14'] });
  const phonePage = await phone.newPage();
  await phonePage.goto('/plan/nutrition');
  await phonePage.getByRole('radio', { name: /Try it for a while/ }).check();
  await phonePage.screenshot({ path: join(OUT, 'mobile.png') });
  await phone.close();
});
