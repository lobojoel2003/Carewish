# Contributing to Carewish

Thank you for helping people say what care they want. There are three common ways to help.

## 1. Correct or review a state's rules

Each state lives in [`packages/form-rules/states/XX.yaml`](packages/form-rules/states). Rules are MIT-licensed so other projects can reuse them.

1. Edit the file. Every change needs a source: put the statute in the document's `citation` or in `sources`.
2. Run `pnpm --filter @carewish/form-rules test`. It validates all 51 files against the JSON Schema and runs semantic checks.
3. Open a pull request using the **State rule correction** template.

If you are an attorney or another qualified reviewer and have checked a state against its statutes, set `review.status: reviewed`, `review.reviewer` and `review.lastChecked`. When the law is ambiguous, prefer the more formal option (for example, witnesses _and_ a notary) and record the question in `review.openQuestions`.

## 2. Add or improve a translation

App text lives in [`apps/web/src/i18n/locales`](apps/web/src/i18n/locales) and the rules library's text in [`packages/form-rules/locales`](packages/form-rules/locales). To add a language:

1. Copy `en.json` to `<code>.json` in both places and translate it. Keep `{{placeholders}}` as they are.
2. Add the code to `LANGUAGES` in `apps/web/src/i18n/index.ts` and to `resources`, and to `LANGUAGES`/`locales` in `packages/form-rules/src/i18n.ts`.
3. Add translated `es`-style entries for state `notes` and `special` text where you can.
4. `pnpm test` checks that every language has the same keys and no empty strings.

Medical and legal wording matters. Plain language that a 6th-grade reader understands is the goal; please ask a native speaker to review.

## 3. Code

```bash
corepack enable           # uses the pnpm version pinned in package.json
pnpm install
pnpm dev                  # http://localhost:3000
pnpm test                 # unit tests
pnpm test:e2e             # Playwright (run `pnpm build` first)
pnpm lint && pnpm typecheck && pnpm format:check
```

For accounts locally, start Postgres (`docker compose up db`) and set `DATABASE_URL` and `CAREWISH_SECRET` in `apps/web/.env.local` (see [.env.example](.env.example)).

### Pull requests

- Keep changes focused, with tests. CI must pass: lint, types, unit tests on Node 22 and 24, end-to-end tests, FHIR validation and the Docker build.
- Use clear commit messages, e.g. `rules(TX): …`, `web: …`, `fhir: …`, `docs: …`.
- Never commit real personal or medical information. Test data must be fictional.

### Releasing (maintainers)

```bash
pnpm version:bump minor   # or patch, major, or an exact version
```

Fill in the new section of [CHANGELOG.md](CHANGELOG.md) and merge to `main`. After CI passes, the Release workflow tags `vX.Y.Z`, publishes a GitHub Release with attested artifacts, and pushes `ghcr.io/lobojoel2003/carewish:X.Y.Z`. Publishing `@carewish/form-rules` to npm is opt-in (`PUBLISH_NPM` variable and `NPM_TOKEN` secret).

## Licenses

By contributing you agree that your contributions are licensed under the AGPL-3.0 (app, `apps/web`) or MIT (rules library, `packages/form-rules`), matching the directory you change.
