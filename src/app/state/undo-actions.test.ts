vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

import { captureSnapshot, undoLastAction } from "./undo-actions";
import { playSE } from "../engine/audio";
import {
  blood,
  sanity,
  board,
  shopUnits,
  shopItems,
  freeRoll,
  cultistUsed,
  onboardingStep,
  rotRingUses,
  selection,
  undoSnapshot,
} from "./game-store";
import { makeUnit } from "../../shared/engine/test-helpers";
import type { ShopSlot, ShopItemSlot } from "../types";

function makeShopSlot(overrides: Partial<ReturnType<typeof makeUnit>> = {}): ShopSlot {
  return { unit: makeUnit(overrides), frozen: false };
}

function makeShopItemSlot(): ShopItemSlot {
  return {
    item: {
      id: "preservative",
      name: "防腐液",
      cost: 3,
      atk: 1,
      hp: 1,
      equip: null,
      skillText: "",
      lore: "",
    },
    frozen: false,
  };
}

beforeEach(() => {
  blood.value = 10;
  sanity.value = 5;
  board.value = [makeUnit({ uid: "u1", atk: 3 }), null, null, null, null];
  shopUnits.value = [makeShopSlot({ uid: "s1" })];
  shopItems.value = [makeShopItemSlot()];
  freeRoll.value = false;
  cultistUsed.value = false;
  onboardingStep.value = null;
  rotRingUses.value = 0;
  selection.value = null;
  undoSnapshot.value = null;
  vi.clearAllMocks();
});

// --- captureSnapshot ---

describe("captureSnapshot", () => {
  it("captures all signal values into undoSnapshot", () => {
    captureSnapshot();
    const snap = undoSnapshot.value!;
    expect(snap).not.toBeNull();
    expect(snap.blood).toBe(10);
    expect(snap.sanity).toBe(5);
    expect(snap.freeRoll).toBe(false);
    expect(snap.cultistUsed).toBe(false);
    expect(snap.onboardingStep).toBeNull();
    expect(snap.rotRingUses).toBe(0);
  });

  it("deep-clones board units (mutations don't affect snapshot)", () => {
    captureSnapshot();
    // Mutate original
    board.value[0]!.atk = 99;
    const snap = undoSnapshot.value!;
    expect(snap.board[0]!.atk).toBe(3); // original value preserved
  });

  it("deep-clones shopUnits (mutations don't affect snapshot)", () => {
    captureSnapshot();
    shopUnits.value[0]!.unit.atk = 99;
    const snap = undoSnapshot.value!;
    expect(snap.shopUnits[0]!.unit.atk).toBe(2); // makeUnit default baseAtk
  });

  it("deep-clones shopItems (mutations don't affect snapshot)", () => {
    captureSnapshot();
    shopItems.value[0]!.item.cost = 99;
    const snap = undoSnapshot.value!;
    expect(snap.shopItems[0]!.item.cost).toBe(3);
  });

  it("handles null entries in board correctly", () => {
    board.value = [null, makeUnit({ uid: "u2" }), null, null, null];
    captureSnapshot();
    const snap = undoSnapshot.value!;
    expect(snap.board[0]).toBeNull();
    expect(snap.board[1]).not.toBeNull();
  });

  it("handles empty shop arrays", () => {
    shopUnits.value = [];
    shopItems.value = [];
    captureSnapshot();
    const snap = undoSnapshot.value!;
    expect(snap.shopUnits).toEqual([]);
    expect(snap.shopItems).toEqual([]);
  });

  it("deep-copies mixed null/non-null shopItems", () => {
    const item1 = makeShopItemSlot();
    const item2 = makeShopItemSlot();
    shopItems.value = [item1, null, item2];
    captureSnapshot();
    const snap = undoSnapshot.value!;
    expect(snap.shopItems[0]).not.toBeNull();
    expect(snap.shopItems[1]).toBeNull();
    expect(snap.shopItems[2]).not.toBeNull();
    // Verify deep copy (different reference)
    expect(snap.shopItems[0]).not.toBe(item1);
    expect(snap.shopItems[2]).not.toBe(item2);
  });
});

// --- undoLastAction ---

describe("undoLastAction", () => {
  it("restores all signals to snapshot values", () => {
    captureSnapshot();
    // Modify all signals
    blood.value = 0;
    sanity.value = 0;
    board.value = [null, null, null, null, null];
    shopUnits.value = [];
    shopItems.value = [];
    freeRoll.value = true;
    cultistUsed.value = true;
    onboardingStep.value = "buy";
    rotRingUses.value = 4;

    undoLastAction();

    expect(blood.value).toBe(10);
    expect(sanity.value).toBe(5);
    expect(board.value[0]!.uid).toBe("u1");
    expect(shopUnits.value).toHaveLength(1);
    expect(shopItems.value).toHaveLength(1);
    expect(freeRoll.value).toBe(false);
    expect(cultistUsed.value).toBe(false);
    expect(onboardingStep.value).toBeNull();
    expect(rotRingUses.value).toBe(0);
  });

  it("clears selection after undo", () => {
    captureSnapshot();
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    undoLastAction();
    expect(selection.value).toBeNull();
  });

  it("sets undoSnapshot to null after undo (single undo, not stack)", () => {
    captureSnapshot();
    undoLastAction();
    expect(undoSnapshot.value).toBeNull();
  });

  it("does nothing when undoSnapshot is null", () => {
    undoSnapshot.value = null;
    blood.value = 7;
    undoLastAction();
    expect(blood.value).toBe(7); // unchanged
  });

  it("plays select sound effect", () => {
    captureSnapshot();
    undoLastAction();
    expect(vi.mocked(playSE)).toHaveBeenCalledWith("select");
  });
});

// --- snapshot isolation ---

describe("snapshot isolation", () => {
  it("second captureSnapshot overwrites first (not a stack)", () => {
    captureSnapshot();
    blood.value = 5;
    captureSnapshot(); // overwrite with blood=5

    blood.value = 0;
    undoLastAction();
    expect(blood.value).toBe(5); // restored to second snapshot, not first
  });
});
