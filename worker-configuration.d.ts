/* eslint-disable typescript/consistent-type-imports -- ambient .d.ts requires import() syntax */
interface SubtleCrypto {
  timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean;
}

interface Env {
  DB: import("@cloudflare/workers-types").D1Database;
  ALLOWED_ORIGIN: string;
  DISCORD_CLIENT_ID: string;
  DISCORD_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OAUTH_STATE_SECRET: string;
}
