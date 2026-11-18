import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { completeWizard, expectAccessible } from './helpers';

test.describe('making a directive', () => {
  test('California: from first question to downloaded documents', async ({ page }) => {
    await completeWizard(page, {
      state: 'California',
      agent: { name: 'Daniel Torres', phone: '(559) 555-0142', relationship: 'child' },
      alternate: { name: 'Lucía Torres', phone: '(559) 555-0199' },
    });

    // review shows the state's own form and parts
    await expect(page.getByTestId('review-document')).toHaveCount(1);
    await expect(
      page.getByRole('heading', { name: 'Advance Health Care Directive' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Part 3: Donation of Organs at Death' }),
    ).toBeVisible();
    await expect(page.getByText('Daniel Torres').first()).toBeVisible();

    // signing checklist and witness checker
    await page.getByTestId('to-sign').click();
    await page.waitForURL('**/sign');
    await expect(page.getByTestId('method-badge')).toHaveText('2 witnesses or a notary');
    await expect(page.getByText(/skilled nursing facility/)).toBeVisible();
    await page.getByTestId('witness-name-0').fill('Daniel Torres');
    await page.getByTestId('witness-name-1').fill('Ana Ruiz');
    const evaluation = page.getByTestId('evaluation-advance-health-care-directive');
    await expect(evaluation).toContainText("Daniel Torres: Can't be a witness");
    await expect(evaluation).toContainText('Your agent or alternate agent');
    await expect(evaluation).toContainText('Ana Ruiz: Can be a witness');
    await page.getByTestId('witness-name-0').fill('Ben Okafor');
    await page
      .getByRole('checkbox', { name: /Named as your agent/ })
      .first()
      .uncheck();
    await expect(evaluation).toContainText("These witnesses meet California's rules.");

    // downloads
    await page.getByTestId('to-export').click();
    await page.waitForURL('**/export');
    await expect(page.getByTestId('wallet-card')).toBeVisible();

    const [pdf] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-pdf').click(),
    ]);
    expect(pdf.suggestedFilename()).toBe('carewish-maria-elena-torres-ca-advance-directive.pdf');
    const pdfBytes = await readFile((await pdf.path())!);
    expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfBytes.length).toBeGreaterThan(15_000);

    const [fhir] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-fhir').click(),
    ]);
    expect(fhir.suggestedFilename()).toMatch(/\.fhir\.json$/);
    const bundle = JSON.parse(await readFile((await fhir.path())!, 'utf8'));
    expect(bundle).toMatchObject({ resourceType: 'Bundle', type: 'document' });
    expect(bundle.entry[0].resource.resourceType).toBe('Composition');

    const [card] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-card').click(),
    ]);
    expect(card.suggestedFilename()).toBe('carewish-maria-elena-torres-wallet-card.pdf');

    const [backup] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('download-backup').click(),
    ]);
    expect(JSON.parse(await readFile((await backup.path())!, 'utf8'))).toMatchObject({
      version: 1,
      state: 'CA',
    });
  });

  test('wallet card QR opens an emergency summary', async ({ page, context }) => {
    await completeWizard(page, {
      state: 'Texas',
      agent: { name: 'Sam Lee', phone: '512-555-0100' },
    });
    await page.goto('/export');
    const url = await page
      .getByTestId('wallet-card')
      .locator('svg[data-url]')
      .getAttribute('data-url');
    expect(url).toMatch(/\/card#[A-Za-z0-9_-]+$/);

    const viewer = await context.newPage();
    await viewer.goto(url!);
    await expect(viewer.getByTestId('card-summary')).toContainText('Maria Elena Torres');
    await expect(viewer.getByRole('link', { name: /Call Sam/ })).toHaveAttribute(
      'href',
      'tel:5125550100',
    );
    await expect(viewer.getByText(/I do not want CPR/)).toBeVisible();
    await viewer.goto('/card#garbage');
    await expect(viewer.getByText('This card link is incomplete or damaged.')).toBeVisible();
  });

  test('Texas uses two documents and appends what they lack', async ({ page }) => {
    await completeWizard(page, {
      state: 'Texas',
      agent: { name: 'Sam Lee', phone: '512-555-0100' },
    });
    await expect(page.getByTestId('review-document')).toHaveCount(2);
    await expect(page.getByRole('heading', { name: 'Statement of My Other Wishes' })).toBeVisible();
  });

  test('North Carolina needs witnesses and a notary', async ({ page }) => {
    await completeWizard(page, {
      state: 'North Carolina',
      agent: { name: 'Sam Lee', phone: '919-555-0100' },
    });
    await page.goto('/sign');
    await expect(page.getByTestId('method-badge').first()).toHaveText('2 witnesses and a notary');
  });

  test('Michigan calls the agent a patient advocate and asks for acceptance', async ({ page }) => {
    await page.goto('/plan/state');
    await page.getByTestId('state-filter').fill('Michigan');
    await page.getByRole('radio', { name: 'Michigan' }).check();
    await expect(page.getByText('Saved on this device')).toBeVisible();
    await page.goto('/plan/agent');
    await expect(
      page.getByText('In Michigan, this person is called your patient advocate.'),
    ).toBeVisible();
    await page.goto('/sign');
    await expect(
      page.getByText(/Ask your patient advocate to sign the acceptance section/),
    ).toBeVisible();
  });

  test('without an agent, agent-only questions and options are hidden', async ({ page }) => {
    await completeWizard(page, { state: 'Florida' });
    await expect(page.getByTestId('review-document')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Living Will', level: 3 })).toBeVisible();
    await page.goto('/plan/terminal');
    await expect(page.getByRole('radio')).toHaveCount(2);
  });

  test('requires answers to required questions', async ({ page }) => {
    await page.goto('/plan/name');
    await page.getByTestId('next').click();
    await expect(page.getByText('Please answer this question to continue.')).toBeVisible();
    await page.goto('/plan/birthdate');
    await page.getByLabel('Month').selectOption('1');
    await page.getByLabel('Day').fill('1');
    await page.getByLabel('Year').fill('2099');
    await page.getByTestId('next').click();
    await expect(page.getByText('That date is in the future.')).toBeVisible();
  });
});

test.describe('languages and accessibility', () => {
  test('switches to Spanish and remembers it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Español' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Diga qué atención médica desea',
    );
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await page.goto('/plan/state');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('¿En qué estado vive?');
    await expect(page.getByTestId('why')).toContainText('¿Por qué importa?');
  });

  test('pages meet WCAG 2.1 AA (no serious issues)', async ({ page }) => {
    await completeWizard(page, {
      state: 'California',
      agent: { name: 'Sam Lee', phone: '559-555-0100' },
    });
    for (const path of [
      '/',
      '/plan/state',
      '/plan/agent',
      '/plan/terminal',
      '/plan/values',
      '/review',
      '/sign',
      '/export',
      '/about',
      '/privacy',
    ]) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectAccessible(page);
    }
  });

  test('shows build information and health', async ({ page, request }) => {
    const health = await (await request.get('/api/health')).json();
    expect(health).toMatchObject({
      status: 'ok',
      version: expect.stringMatching(/^\d+\.\d+\.\d+/),
    });
    await page.goto('/about');
    await expect(page.getByTestId('about-version')).toContainText(`Version ${health.version}`);
  });

  test('sends security headers', async ({ request }) => {
    const res = await request.get('/');
    expect(res.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
    expect(res.headers()['referrer-policy']).toBe('no-referrer');
  });
});
