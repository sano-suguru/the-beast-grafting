interface Env {
  DB: import("@cloudflare/workers-types").D1Database;
  ALLOWED_ORIGIN: string;
}
