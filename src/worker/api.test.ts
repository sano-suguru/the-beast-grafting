import api from "./api";

const mockEnv = {
  DB: {},
  ALLOWED_ORIGIN: "http://localhost:5173",
  DISCORD_CLIENT_ID: "",
  DISCORD_CLIENT_SECRET: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  OAUTH_STATE_SECRET: "test-secret",
} as Env;

describe("API routes", () => {
  it("GET /health returns alive status", async () => {
    const res = await api.request("/health", {}, mockEnv);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "alive", message: "工房は稼働中だ。" });
  });

  it("returns 404 for unknown route", async () => {
    const res = await api.request("/nonexistent", {}, mockEnv);
    expect(res.status).toBe(404);
  });
});
