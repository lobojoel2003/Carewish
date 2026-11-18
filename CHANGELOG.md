# Changelog

All notable changes to Carewish are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/). The app and the rules library share
one version number.

## [Unreleased]

## [1.0.0] - 2026-11-18

The first public release.

### Added

- **Guided wizard.** 19 short questions, one per screen, in calm everyday words, each with a "why does this matter" note. Agent-only questions and options are hidden when no one is named. Answers save to IndexedDB on the device as you go.
- **All 50 states and DC.** `@carewish/form-rules` (MIT) describes each jurisdiction in one YAML file: its documents and statutory citations, the parts of each form and which answers go in them, what the state calls the decision-maker, witness rules, notary rules and special settings such as nursing homes. Validated by a JSON Schema and semantic checks; 105 tests.
- **Witness checker.** A rules engine (`none-may-be`, `at-least-one-not`, `at-most-one`) over a vocabulary of 19 attributes, derived from how a witness is related to you. The app asks only the questions that matter in your state and flags your agent automatically.
- **State-shaped PDF.** pdf-lib generates a signing-instructions page plus each of your state's documents, with its own part titles, witness declarations written from the state's rules, a notary acknowledgment where needed, agent acceptance where required, page initials and an appendix for wishes the statutory form has no place for. Fillable official PDFs can be mapped through a `template` field.
- **FHIR export.** A document Bundle following the HL7 PACIO Advance Directive Interoperability guide (STU 1): Composition, US Core Patient, healthcare agents with a Consent granting or limiting powers, preference care plans, intervention and care-experience preferences, and organ donation. Validated in CI with the HL7 validator.
- **Wallet card.** A printable fold-over card with a QR code. Without an account the code carries a compressed summary in the URL fragment, which never reaches a server; with an account it opens an end-to-end encrypted copy of the full document.
- **Optional encrypted accounts.** PBKDF2-SHA-256 (600,000 iterations) and HKDF in the browser; the server stores only ciphertext and a scrypt hash of a derived key. Postgres storage with automatic migrations, optimistic concurrency for sync, rate limiting, same-origin checks and HttpOnly SameSite=Strict sessions. Accounts switch on when `DATABASE_URL` is set.
- **English and Spanish** from day one, with i18next, including the rules library's own text.
- **Accessibility.** Atkinson Hyperlegible type, WCAG 2.1 AA checks with axe in end-to-end tests, keyboard focus management, light and dark themes, reduced motion.
- **Delivery.** GitHub Actions for linting, type checks, unit tests on Node 22 and 24, Playwright end-to-end tests against Postgres, FHIR validation, Docker builds and CodeQL; automatic tagging, GitHub Releases with attested artifacts, and multi-arch images on GHCR.

[Unreleased]: https://github.com/lobojoel2003/Carewish/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/lobojoel2003/Carewish/releases/tag/v1.0.0
