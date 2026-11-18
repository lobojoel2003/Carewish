#!/usr/bin/env node
// Prints release notes for a version: its CHANGELOG section plus install details.
//   node scripts/release-notes.mjs 1.0.0
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const version =
  process.argv[2] ?? JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
const changelog = readFileSync(join(root, 'CHANGELOG.md'), 'utf8');

const start = changelog.indexOf(`## [${version}]`);
if (start === -1) {
  console.error(`CHANGELOG.md has no section for ${version}`);
  process.exit(1);
}
const rest = changelog.slice(start);
const end = rest.slice(3).search(/\n## \[|\n\[[^\]]+\]: /);
const section = (end === -1 ? rest : rest.slice(0, end + 3)).split('\n').slice(1).join('\n').trim();

const build = process.env.BUILD_NUMBER ? ` · build ${process.env.BUILD_NUMBER}` : '';
const commit = process.env.COMMIT_SHA ? ` · commit ${process.env.COMMIT_SHA.slice(0, 7)}` : '';

console.log(`${section}

---

**Carewish ${version}**${build}${commit}

### Run it

\`\`\`bash
docker run -p 3000:3000 ghcr.io/lobojoel2003/carewish:${version}
\`\`\`

Or download \`carewish-web-${version}-standalone.tar.gz\`, unpack it, and run \`node carewish/apps/web/server.js\` (Node 20.9+).

### Release files

| File | What it is |
| --- | --- |
| \`carewish-web-${version}-standalone.tar.gz\` | The web app as a self-contained Node.js server (AGPL-3.0) |
| \`carewish-form-rules-${version}.tgz\` | The \`@carewish/form-rules\` npm package (MIT) |
| \`carewish-form-rules-${version}-yaml.zip\` | The 51 state rule files, JSON schema and translations (MIT) |
| \`carewish-samples-${version}.zip\` | Example PDFs, FHIR bundles and wallet cards for a fictional person |
| \`SHA256SUMS.txt\` | Checksums. Build provenance is attested with GitHub artifact attestations. |

Carewish gives legal information, not legal advice.`);
