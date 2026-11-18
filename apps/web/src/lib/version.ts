/** Build information, injected by next.config.ts at build time. */
export const VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
export const BUILD_NUMBER = process.env.NEXT_PUBLIC_BUILD_NUMBER ?? 'local';
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? 'dev';
export const BUILD_DATE = process.env.NEXT_PUBLIC_BUILD_DATE ?? '';
export const REPO_URL = 'https://github.com/lobojoel2003/Carewish';

export const buildInfo = {
  version: VERSION,
  build: BUILD_NUMBER,
  commit: COMMIT_SHA,
  date: BUILD_DATE,
} as const;
