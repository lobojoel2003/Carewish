#!/usr/bin/env node
// Sets one version across the monorepo and opens a CHANGELOG section for it.
//   pnpm version:bump 1.2.0
//   pnpm version:bump patch | minor | major
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const files = ['package.json', 'packages/form-rules/package.json', 'apps/web/package.json'];
const current = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const arg = process.argv[2];

const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
function next(version, kind) {
  const m = SEMVER.exec(version);
  if (!m) throw new Error(`Not a semantic version: ${version}`);
  const [maj, min, pat] = m.slice(1, 4).map(Number);
  if (kind === 'major') return `${maj + 1}.0.0`;
  if (kind === 'minor') return `${maj}.${min + 1}.0`;
  if (kind === 'patch') return `${maj}.${min}.${pat + 1}`;
  throw new Error(`Unknown bump: ${kind}`);
}

if (!arg) {
  console.error('Usage: pnpm version:bump <version|patch|minor|major>');
  process.exit(1);
}
const version = SEMVER.test(arg) ? arg : next(current, arg);

for (const file of files) {
  const path = join(root, file);
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  pkg.version = version;
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
}

const changelogPath = join(root, 'CHANGELOG.md');
const changelog = readFileSync(changelogPath, 'utf8');
if (!changelog.includes(`## [${version}]`)) {
  const today = new Date().toISOString().slice(0, 10);
  const updated = changelog.replace(
    /## \[Unreleased\]\n/,
    `## [Unreleased]\n\n## [${version}] - ${today}\n`,
  );
  const link = `[${version}]: https://github.com/lobojoel2003/Carewish/releases/tag/v${version}`;
  writeFileSync(
    changelogPath,
    updated.includes(link) ? updated : `${updated.trimEnd()}\n${link}\n`,
  );
}
console.log(
  `${current} → ${version}. Fill in CHANGELOG.md, then commit and merge to main to release.`,
);
