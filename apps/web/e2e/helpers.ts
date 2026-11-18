import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

export interface Person {
  name: string;
  phone: string;
  relationship?: string;
}

/** Clicks Continue and waits for the next step (or the review page). */
export async function next(page: Page, to: string): Promise<void> {
  await page.getByTestId('next').click();
  if (to === 'review') {
    await page.waitForURL('**/review');
    return;
  }
  await page.waitForURL(`**/plan/${to}`);
  await expect(page.locator('h1')).toBeFocused();
}

export async function choose(page: Page, label: string | RegExp): Promise<void> {
  await page.getByRole('radio', { name: label }).check();
}

/** Walks the whole wizard with typical answers. */
export async function completeWizard(
  page: Page,
  opts: { state: string; name?: string; agent?: Person; alternate?: Person } = {
    state: 'California',
  },
): Promise<void> {
  await page.goto('/');
  await page.getByTestId('start').click();
  await page.waitForURL('**/plan/state');
  await page.getByTestId('state-filter').fill(opts.state);
  await page.getByRole('radio', { name: opts.state, exact: true }).check();
  await next(page, 'name');
  await page.getByTestId('name').fill(opts.name ?? 'Maria Elena Torres');
  await next(page, 'birthdate');
  await page.getByLabel('Month').selectOption('3');
  await page.getByLabel('Day').fill('4');
  await page.getByLabel('Year').fill('1956');
  await next(page, 'address');
  await page.getByLabel('City').fill('Fresno');
  await next(page, 'agent');
  if (opts.agent) {
    await page.getByTestId('person-name').fill(opts.agent.name);
    if (opts.agent.relationship)
      await page.getByLabel('Relationship to you').selectOption(opts.agent.relationship);
    await page.getByTestId('person-phone').fill(opts.agent.phone);
    await next(page, 'alternate');
    if (opts.alternate) {
      await page.getByTestId('person-name').fill(opts.alternate.name);
      await page.getByTestId('person-phone').fill(opts.alternate.phone);
    }
    await next(page, 'authority');
    await choose(page, /Yes\. I trust them/);
    await next(page, 'terminal');
  } else {
    await page.getByTestId('skip').click();
    await page.waitForURL('**/plan/terminal');
  }
  await choose(page, /Focus on comfort/);
  await next(page, 'unconscious');
  await choose(page, /Focus on comfort/);
  await next(page, 'advanced-illness');
  await choose(page, /Try every treatment/);
  await next(page, 'nutrition');
  await choose(page, /Try it for a while/);
  await next(page, 'cpr');
  await choose(page, /No, not if/);
  await next(page, 'pain');
  await choose(page, /Keep me comfortable/);
  await next(page, 'values');
  await page.getByRole('checkbox', { name: 'Being at home' }).check();
  await next(page, 'place');
  await choose(page, 'At home');
  await next(page, 'spiritual');
  await page.getByRole('textbox').fill('Please call Father José.');
  await next(page, 'organ');
  await choose(page, /Yes, any organs/);
  await next(page, 'physician');
  await page.getByLabel("Doctor's name").fill('Dr. Priya Shah');
  await next(page, 'other');
  await page.getByRole('textbox').fill('Play jazz, please.');
  await next(page, 'review');
}

/** Fails on serious or critical WCAG 2.1 AA violations. */
export async function expectAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  expect(
    serious.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(', ')})`),
  ).toEqual([]);
}
