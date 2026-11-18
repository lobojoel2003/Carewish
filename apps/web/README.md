# @carewish/web

The Carewish web app: a Next.js 16 app that guides a person through an advance directive, fills in their state's form, and exports a PDF, a FHIR bundle and a wallet card. Licensed [AGPL-3.0](../../LICENSE).

See the [main README](../../README.md) for features, configuration and screenshots.

## Layout

| Path             | Contents                                                                                                                                                                                                                                                                    |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app`        | Routes: home, `/plan/[step]` wizard, `/review`, `/sign`, `/export`, `/card` (emergency summary), `/v/[id]` (encrypted card link), `/account`, and `api/*`                                                                                                                   |
| `src/components` | UI: wizard inputs, review blocks, signing checklist and witness checker, export, account                                                                                                                                                                                    |
| `src/lib`        | `answers` (model and validation), `steps` (wizard), `plan` (which state documents), `statements` (shared wording), `fhir/bundle`, `pdf/*` (writer, directive, wallet card, AcroForm filling), `card` (QR payloads), `crypto` (end-to-end encryption), `storage` (IndexedDB) |
| `src/server`     | Postgres access, migrations, authentication, rate limiting, HTTP helpers                                                                                                                                                                                                    |
| `src/i18n`       | i18next setup and `en`/`es` translations                                                                                                                                                                                                                                    |
| `tests`          | Vitest unit tests (PGlite stands in for Postgres)                                                                                                                                                                                                                           |
| `e2e`            | Playwright tests, including accessibility checks and the accounts flow                                                                                                                                                                                                      |
| `scripts`        | `migrate.mjs` (database), `samples.test.ts` (example outputs)                                                                                                                                                                                                               |

## Scripts

```bash
pnpm dev            # http://localhost:3000
pnpm build          # standalone production build
pnpm test           # unit tests
pnpm test:e2e       # Playwright (after pnpm build); set DATABASE_URL to include account tests
pnpm samples        # example PDFs, FHIR bundles and wallet cards in ./samples
pnpm db:migrate     # apply migrations ahead of a deploy (they also run automatically)
```
