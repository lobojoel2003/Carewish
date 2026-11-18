import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Generates sample files (PDF, FHIR, wallet card) into ./samples for releases and FHIR validation. */
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['scripts/samples.test.ts'], environment: 'node', testTimeout: 120_000 },
});
