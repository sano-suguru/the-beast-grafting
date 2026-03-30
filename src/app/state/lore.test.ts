import { safeSetItem } from "./storage";

const store = new Map<string, string>();

vi.mock("./storage", () => ({
  safeGetItem: vi.fn((key: string) => store.get(key) ?? null),
  safeSetItem: vi.fn((key: string, value: string) => {
    store.set(key, value);
  }),
}));

beforeEach(() => {
  store.clear();
  vi.resetModules();
});

async function freshLore() {
  return import("./lore");
}

// ---------------------------------------------------------------------------
// markSeen
// ---------------------------------------------------------------------------
describe("markSeen", () => {
  it("marks a single ID as seen", async () => {
    const { loreDb, markSeen } = await freshLore();
    markSeen(["rat"]);
    expect(loreDb.value["rat"]).toEqual({ seen: true, mastered: false });
  });

  it("marks multiple IDs as seen", async () => {
    const { loreDb, markSeen } = await freshLore();
    markSeen(["rat", "bat"]);
    expect(loreDb.value["rat"]).toEqual({ seen: true, mastered: false });
    expect(loreDb.value["bat"]).toEqual({ seen: true, mastered: false });
  });

  it("does not update signal when already seen", async () => {
    const { loreDb, markSeen } = await freshLore();
    loreDb.value = { rat: { seen: true, mastered: false } };
    const prev = loreDb.value;
    markSeen(["rat"]);
    expect(loreDb.value).toBe(prev);
  });

  it("skips empty string IDs", async () => {
    const { loreDb, markSeen } = await freshLore();
    markSeen(["", "rat"]);
    expect(loreDb.value[""]).toBeUndefined();
    expect(loreDb.value["rat"]).toEqual({ seen: true, mastered: false });
  });

  it("is no-op for empty array", async () => {
    const { loreDb, markSeen } = await freshLore();
    const prev = loreDb.value;
    markSeen([]);
    expect(loreDb.value).toBe(prev);
  });

  it("preserves existing mastered flag", async () => {
    const { loreDb, markSeen } = await freshLore();
    loreDb.value = { rat: { mastered: true, seen: true } };
    markSeen(["rat"]);
    expect(loreDb.value["rat"]!.mastered).toBe(true);
  });

  it("persists via safeSetItem", async () => {
    const { markSeen } = await freshLore();
    markSeen(["rat"]);
    expect(safeSetItem).toHaveBeenCalledWith("beastGrafterLore", expect.stringContaining('"rat"'));
  });
});

// ---------------------------------------------------------------------------
// markMastered
// ---------------------------------------------------------------------------
describe("markMastered", () => {
  it("sets both mastered and seen", async () => {
    const { loreDb, markMastered } = await freshLore();
    markMastered(["rat"]);
    expect(loreDb.value["rat"]).toEqual({ mastered: true, seen: true });
  });

  it("does not update signal when already mastered", async () => {
    const { loreDb, markMastered } = await freshLore();
    loreDb.value = { rat: { mastered: true, seen: true } };
    const prev = loreDb.value;
    markMastered(["rat"]);
    expect(loreDb.value).toBe(prev);
  });

  it("preserves other entries", async () => {
    const { loreDb, markMastered } = await freshLore();
    loreDb.value = { bat: { seen: true, mastered: false } };
    markMastered(["rat"]);
    expect(loreDb.value["bat"]).toEqual({ seen: true, mastered: false });
    expect(loreDb.value["rat"]).toEqual({ mastered: true, seen: true });
  });

  it("handles multiple IDs", async () => {
    const { loreDb, markMastered } = await freshLore();
    markMastered(["rat", "bat"]);
    expect(loreDb.value["rat"]).toEqual({ mastered: true, seen: true });
    expect(loreDb.value["bat"]).toEqual({ mastered: true, seen: true });
  });
});

// ---------------------------------------------------------------------------
// loadLoreFromStorage (tested via module re-import)
// ---------------------------------------------------------------------------
describe("loadLoreFromStorage", () => {
  it("loads valid JSON from storage", async () => {
    store.set("beastGrafterLore", JSON.stringify({ rat: { seen: true, mastered: false } }));
    const { loreDb } = await freshLore();
    expect(loreDb.value["rat"]).toEqual({ seen: true, mastered: false });
  });

  it("crashes on incomplete entry", async () => {
    store.set("beastGrafterLore", JSON.stringify({ rat: { seen: true } }));
    await expect(freshLore()).rejects.toThrow("Invalid lore entry");
  });

  it("returns empty object for invalid JSON", async () => {
    store.set("beastGrafterLore", "not json");
    const { loreDb } = await freshLore();
    expect(loreDb.value).toEqual({});
  });

  it("returns empty object for array", async () => {
    store.set("beastGrafterLore", "[1,2,3]");
    const { loreDb } = await freshLore();
    expect(loreDb.value).toEqual({});
  });
});
