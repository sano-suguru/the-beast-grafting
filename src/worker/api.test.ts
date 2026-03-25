import api from "./api";

describe("API routes", () => {
  it("GET /health returns alive status", async () => {
    const res = await api.request("/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "alive", message: "工房は稼働中だ。" });
  });

  it("returns 404 for unknown route", async () => {
    const res = await api.request("/nonexistent");
    expect(res.status).toBe(404);
  });
});
