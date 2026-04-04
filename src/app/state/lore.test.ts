import type { LoreResponse } from "../../shared/api-types";
import { loreDb, loadLore, _resetForTest } from "./lore";

function mockFetchResponse(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));
}

beforeEach(() => {
  _resetForTest();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("loadLore", () => {
  it("populates loreDb from server response", async () => {
    const data: LoreResponse = {
      rat: { mastered: false },
      bat: { mastered: true },
    };
    mockFetchResponse({ lore: data });

    await loadLore();

    expect(loreDb.value).toEqual(data);
  });

  it("keeps loreDb empty on HTTP error", async () => {
    mockFetchResponse({ error: "internal" }, 500);

    await loadLore();

    expect(loreDb.value).toEqual({});
  });

  it("keeps loreDb empty on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    await loadLore();

    expect(loreDb.value).toEqual({});
  });

  it("overwrites previous loreDb on reload", async () => {
    loreDb.value = { old: { mastered: false } };
    const data: LoreResponse = { rat: { mastered: true } };
    mockFetchResponse({ lore: data });

    await loadLore();

    expect(loreDb.value).toEqual(data);
    expect(loreDb.value["old"]).toBeUndefined();
  });

  it("calls /api/lore with credentials included", async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ lore: {} }), { status: 200 }));
    vi.stubGlobal("fetch", spy);

    await loadLore();

    expect(spy).toHaveBeenCalledWith(
      "/api/lore",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("deduplicates concurrent calls", async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ lore: { rat: { mastered: false } } })));
    vi.stubGlobal("fetch", spy);

    await Promise.all([loadLore(), loadLore()]);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(loreDb.value["rat"]).toEqual({ mastered: false });
  });

  it("skips refetch within staleness window", async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ lore: { rat: { mastered: false } } })));
    vi.stubGlobal("fetch", spy);

    await loadLore();
    await loadLore();

    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("refetches after staleness window expires", async () => {
    vi.useFakeTimers();
    const spy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ lore: { rat: { mastered: false } } })));
    vi.stubGlobal("fetch", spy);

    await loadLore();
    vi.advanceTimersByTime(30_001);
    await loadLore();

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("retries immediately after error (no staleness cache)", async () => {
    mockFetchResponse({ error: "fail" }, 500);
    await loadLore();

    const spy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ lore: { rat: { mastered: true } } })));
    vi.stubGlobal("fetch", spy);
    await loadLore();

    expect(spy).toHaveBeenCalledTimes(1);
    expect(loreDb.value["rat"]).toEqual({ mastered: true });
  });
});
