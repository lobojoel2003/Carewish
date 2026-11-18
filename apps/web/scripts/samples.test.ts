/**
 * Writes example output for a fictional person to ./samples:
 * a directive PDF, a FHIR bundle and a wallet card for several states.
 * Used for release assets, FHIR validation in CI and the README.
 *
 *   pnpm --filter @carewish/web samples
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { StateCode } from '@carewish/form-rules';
import { it } from 'vitest';
import { englishT } from '@/i18n';
import { cardUrl, encodeCard, summarize } from '@/lib/card';
import { buildAdiBundle } from '@/lib/fhir/bundle';
import { buildWalletCardPdf } from '@/lib/pdf/card';
import { buildDirectivePdf } from '@/lib/pdf/directive';
import { VERSION } from '@/lib/version';
import { NOW, counterUuid, fonts, fullAnswers } from '../tests/fixtures';

const OUT = join(import.meta.dirname, '..', 'samples');
const STATES: StateCode[] = ['CA', 'TX', 'NY', 'FL', 'NC', 'MI'];

it('generates samples', async () => {
  mkdirSync(OUT, { recursive: true });
  const t = englishT();
  for (const state of STATES) {
    const answers = fullAnswers(state);
    const slug = state.toLowerCase();
    writeFileSync(
      join(OUT, `${slug}-advance-directive.pdf`),
      await buildDirectivePdf(answers, { fonts, t, now: NOW, appVersion: VERSION }),
    );
    const bundle = buildAdiBundle(answers, {
      t,
      lang: 'en',
      now: NOW,
      uuid: counterUuid(),
      appVersion: VERSION,
    });
    writeFileSync(
      join(OUT, `${slug}-advance-directive.fhir.json`),
      `${JSON.stringify(bundle, null, 2)}\n`,
    );
    const url = cardUrl(
      'https://carewish.example',
      await encodeCard(summarize(answers, 'en', NOW)),
    );
    writeFileSync(
      join(OUT, `${slug}-wallet-card.pdf`),
      await buildWalletCardPdf(answers, { fonts, url, t, tEn: t, lang: 'en', now: NOW }),
    );
  }
  console.log(`wrote samples for ${STATES.join(', ')} to ${OUT}`);
});
