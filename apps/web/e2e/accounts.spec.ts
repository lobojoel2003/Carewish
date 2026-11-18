import { expect, test } from '@playwright/test';
import { completeWizard } from './helpers';

// Needs a Postgres database: run with DATABASE_URL set (CI provides one).
test.skip(!process.env.DATABASE_URL, 'accounts need DATABASE_URL');

const password = 'correct horse battery staple';

test('encrypted account: sign up, card link, restore on another device, delete', async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const email = `e2e-${Date.now()}@example.com`;
  await completeWizard(page, {
    state: 'California',
    name: 'Rosa Account',
    agent: { name: 'Sam Lee', phone: '559-555-0100' },
  });

  await page.goto('/account');
  await page.getByTestId('account-email').fill(email);
  await page.getByTestId('account-password').fill(password);
  await page.getByTestId('account-confirm').check();
  await page.getByTestId('account-submit').click();
  await expect(page.getByTestId('signed-in-as')).toContainText(email);

  // card link: the document is encrypted in this browser; the key lives only in the QR link
  await page.goto('/export');
  await page.getByTestId('share-link').click();
  await expect(page.getByTestId('share-link')).toHaveText('Update linked document', {
    timeout: 30_000,
  });
  const url = await page
    .getByTestId('wallet-card')
    .locator('svg[data-url]')
    .getAttribute('data-url');
  expect(url).toMatch(/\/v\/[A-Za-z0-9_-]{22}#k=[A-Za-z0-9_-]{43}$/);

  const other = await browser.newContext();
  const viewer = await other.newPage();
  await viewer.goto(url!);
  await expect(viewer.getByTestId('shared-document')).toContainText('Rosa Account');
  const [pdf] = await Promise.all([
    viewer.waitForEvent('download'),
    viewer.getByRole('button', { name: 'Download the PDF' }).click(),
  ]);
  expect(pdf.suggestedFilename()).toBe('carewish-rosa-account-advance-directive.pdf');

  // a link without its key can't be opened
  await viewer.goto(url!.split('#')[0]!);
  await expect(viewer.getByText(/missing its key/)).toBeVisible();

  // sign in on a "new device" and get the answers back
  await viewer.goto('/account');
  await viewer.getByRole('button', { name: 'Already have an account? Sign in' }).click();
  await viewer.getByTestId('account-email').fill(email);
  await viewer.getByTestId('account-password').fill(password);
  await viewer.getByTestId('account-submit').click();
  await expect(viewer.getByTestId('signed-in-as')).toContainText(email);
  await viewer.goto('/review');
  await expect(viewer.getByText('Rosa Account').first()).toBeVisible();

  // wrong password is rejected
  const third = await (await browser.newContext()).newPage();
  await third.goto('/account');
  await third.getByRole('button', { name: 'Already have an account? Sign in' }).click();
  await third.getByTestId('account-email').fill(email);
  await third.getByTestId('account-password').fill('not the right password');
  await third.getByTestId('account-submit').click();
  await expect(third.getByText("That email and password don't match.")).toBeVisible();

  // delete the account
  viewer.on('dialog', (d) => d.accept());
  await viewer.goto('/account');
  await viewer.getByRole('button', { name: 'Delete my account' }).click();
  await expect(viewer.getByTestId('account-email')).toBeVisible();
  await page.reload();
  await page.goto(url!);
  await expect(page.getByText(/removed or never existed/)).toBeVisible();
  await other.close();
});
