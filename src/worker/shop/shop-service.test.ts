import { makeUnit } from "../../engine/test-helpers";
import { createSeededRng } from "../../engine/rng";
import { unitInstanceToBoardUnit } from "../../shared/board-unit";
import type { BoardUnit } from "../../shared/board-unit";
import { UNIT_COST } from "../../shared/constants";
import { ITEMS } from "../../shared/data/items";
import type { ShopSlotJson, ShopItemSlotJson } from "../../db/shop-state-types";
import type { ShopStateRow } from "./shop-service";
import {
  executeSetup,
  executeRoll,
  executeBuy,
  executeSell,
  executeEquip,
  executeFreeze,
  executeSwap,
  executeCultist,
  executeDismissEvent,
  executeUndo,
  executeReady,
} from "./shop-service";

function makeState(overrides: Partial<ShopStateRow> = {}): ShopStateRow {
  const rng = createSeededRng(42);
  const { s0, s1 } = rng.getState();
  return {
    blood: 10,
    board: [null, null, null, null, null],
    shopUnits: [],
    shopItems: [],
    freeRoll: false,
    cultistUsed: false,
    rotRingUses: 0,
    activeEvent: null,
    rngS0: s0,
    rngS1: s1,
    undoSnapshot: null,
    round: 1,
    sanity: 5,
    ...overrides,
  };
}

function makeShopSlot(id: string = "rat", frozen = false): ShopSlotJson {
  return { unit: unitInstanceToBoardUnit(makeUnit({ id: id as any })), frozen };
}

function makeItemSlot(itemId: string = "preservative", frozen = false): ShopItemSlotJson {
  return { itemId, frozen };
}

function makeBoardUnit(id: string = "rat"): BoardUnit {
  return unitInstanceToBoardUnit(makeUnit({ id: id as any }));
}

describe("executeSetup", () => {
  test("tutorial shop generates rat/rat/bat", () => {
    const result = executeSetup(1, 5, null, 42, [null, null, null, null, null], true);
    const ids = result.shopUnits.filter(Boolean).map((s) => s!.unit.id);
    expect(ids).toEqual(["rat", "rat", "bat"]);
  });

  test("thief origin gets freeRoll=true", () => {
    const result = executeSetup(1, 5, "thief", 42, [null, null, null, null, null], true);
    expect(result.freeRoll).toBe(true);
  });

  test("inquisitor upgrades one shop unit tier", () => {
    const results = Array.from({ length: 20 }, (_, i) =>
      executeSetup(1, 5, "inquisitor", i + 1, [null, null, null, null, null], true),
    );
    const hasHigherTier = results.some((r) =>
      r.shopUnits.some((s) => s !== null && s.unit.tier > 1),
    );
    expect(hasHigherTier).toBe(true);
  });

  test("non-tutorial generates shop units appropriate for round", () => {
    const result = executeSetup(3, 5, null, 42, [null, null, null, null, null], false);
    const nonNull = result.shopUnits.filter(Boolean);
    expect(nonNull.length).toBeGreaterThan(0);
    expect(nonNull.length).toBeLessThanOrEqual(5);
  });

  test("blood starts at 10", () => {
    const result = executeSetup(1, 5, null, 42, [null, null, null, null, null], true);
    expect(result.blood).toBe(10);
  });
});

describe("executeRoll", () => {
  test("deducts 1 blood on paid roll", () => {
    const state = makeState({ shopUnits: [makeShopSlot()], shopItems: [makeItemSlot()] });
    const result = executeRoll(state, null);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().blood).toBe(9);
  });

  test("free roll does not deduct blood, resets freeRoll to false", () => {
    const state = makeState({
      freeRoll: true,
      shopUnits: [makeShopSlot()],
      shopItems: [makeItemSlot()],
    });
    const result = executeRoll(state, null);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.blood).toBe(10);
    expect(next.freeRoll).toBe(false);
  });

  test("fails with INSUFFICIENT_RESOURCE when blood=0 and no freeRoll", () => {
    const state = makeState({ blood: 0 });
    const result = executeRoll(state, null);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INSUFFICIENT_RESOURCE");
  });

  test("lockRoll event blocks roll", () => {
    const state = makeState({
      activeEvent: { lockRoll: true } as any,
    });
    const result = executeRoll(state, null);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("PRECONDITION_FAILED");
  });
});

describe("executeBuy", () => {
  test("places unit on empty slot, deducts UNIT_COST blood", () => {
    const state = makeState({ shopUnits: [makeShopSlot("rat")] });
    const result = executeBuy(state, 0, 0);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.blood).toBe(10 - UNIT_COST);
    expect(next.board[0]).not.toBeNull();
    expect(next.board[0]!.id).toBe("rat");
  });

  test("grafts same-id unit on occupied slot", () => {
    const boardUnit = makeBoardUnit("rat");
    const state = makeState({
      board: [boardUnit, null, null, null, null],
      shopUnits: [makeShopSlot("rat")],
    });
    const result = executeBuy(state, 0, 0);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.board[0]!.atk).toBeGreaterThan(boardUnit.atk);
  });

  test("fails with INSUFFICIENT_RESOURCE when not enough blood", () => {
    const state = makeState({ blood: 1, shopUnits: [makeShopSlot()] });
    const result = executeBuy(state, 0, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INSUFFICIENT_RESOURCE");
  });

  test("fails with INVALID_TARGET for incompatible unit", () => {
    const state = makeState({
      board: [makeBoardUnit("bat"), null, null, null, null],
      shopUnits: [makeShopSlot("rat")],
    });
    const result = executeBuy(state, 0, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_TARGET");
  });

  test("saves undo snapshot", () => {
    const state = makeState({ shopUnits: [makeShopSlot()] });
    const result = executeBuy(state, 0, 0);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().undoSnapshot).not.toBeNull();
    expect(result._unsafeUnwrap().undoSnapshot!.blood).toBe(10);
  });

  test("removes bought unit from shopUnits", () => {
    const state = makeState({ shopUnits: [makeShopSlot(), makeShopSlot("bat")] });
    const result = executeBuy(state, 0, 0);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.shopUnits[0]).toBeNull();
    expect(next.shopUnits[1]).not.toBeNull();
  });

  test("fails with INVALID_INDEX for out-of-bounds shopIndex", () => {
    const state = makeState({ shopUnits: [makeShopSlot()] });
    const result = executeBuy(state, 5, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_INDEX");
  });

  test("fails with INVALID_INDEX on empty shop", () => {
    const state = makeState({ shopUnits: [] });
    const result = executeBuy(state, 0, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_INDEX");
  });
});

describe("executeSell", () => {
  test("removes unit from board, gains 1 blood", () => {
    const state = makeState({
      blood: 5,
      board: [makeBoardUnit("rat"), null, null, null, null],
    });
    const result = executeSell(state, 0, null);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.blood).toBe(6);
    expect(next.board[0]).toBeNull();
  });

  test("beggar gives 2 blood", () => {
    const state = makeState({
      blood: 5,
      board: [makeBoardUnit("beggar"), null, null, null, null],
    });
    const result = executeSell(state, 0, null);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().blood).toBe(7);
  });

  test("surgeon buffs a random remaining unit (+1/+1)", () => {
    const unit0 = makeBoardUnit("rat");
    const unit1 = makeBoardUnit("bat");
    const state = makeState({
      board: [unit0, unit1, null, null, null],
    });
    const result = executeSell(state, 0, "surgeon");
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.board[0]).toBeNull();
    const remaining = next.board[1]!;
    expect(remaining.atk).toBe(unit1.atk + 1);
    expect(remaining.hp).toBe(unit1.hp + 1);
  });

  test("fails on empty slot", () => {
    const state = makeState();
    const result = executeSell(state, 0, null);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_TARGET");
  });
});

describe("executeEquip", () => {
  test("applies item stats to unit, deducts item cost", () => {
    const item = ITEMS["preservative"];
    const unit = makeBoardUnit("rat");
    const state = makeState({
      board: [unit, null, null, null, null],
      shopItems: [makeItemSlot("preservative")],
    });
    const result = executeEquip(state, 0, 0);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.blood).toBe(10 - item.cost);
    expect(next.board[0]!.atk).toBe(unit.atk + item.atk);
    expect(next.board[0]!.hp).toBe(unit.hp + item.hp);
  });

  test("fails when no target unit", () => {
    const state = makeState({ shopItems: [makeItemSlot("preservative")] });
    const result = executeEquip(state, 0, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_TARGET");
  });

  test("fails with insufficient blood", () => {
    const state = makeState({
      blood: 0,
      board: [makeBoardUnit("rat"), null, null, null, null],
      shopItems: [makeItemSlot("preservative")],
    });
    const result = executeEquip(state, 0, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INSUFFICIENT_RESOURCE");
  });

  test("removes item from shopItems", () => {
    const state = makeState({
      board: [makeBoardUnit("rat"), null, null, null, null],
      shopItems: [makeItemSlot("preservative"), makeItemSlot("iron_plate")],
    });
    const result = executeEquip(state, 0, 0);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.shopItems[0]).toBeNull();
    expect(next.shopItems[1]).not.toBeNull();
  });

  test("fails with INVALID_INDEX for out-of-bounds shopItemIndex", () => {
    const state = makeState({
      board: [makeBoardUnit("rat"), null, null, null, null],
      shopItems: [makeItemSlot()],
    });
    const result = executeEquip(state, 5, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_INDEX");
  });
});

describe("executeFreeze", () => {
  test("freezes an unfrozen unit", () => {
    const state = makeState({ shopUnits: [makeShopSlot("rat", false)] });
    const result = executeFreeze(state, true, 0, true);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().shopUnits[0]!.frozen).toBe(true);
  });

  test("unfreezes a frozen unit", () => {
    const state = makeState({ shopUnits: [makeShopSlot("rat", true)] });
    const result = executeFreeze(state, true, 0, false);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().shopUnits[0]!.frozen).toBe(false);
  });

  test("freezes an unfrozen item", () => {
    const state = makeState({ shopItems: [makeItemSlot("preservative", false)] });
    const result = executeFreeze(state, false, 0, true);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().shopItems[0]!.frozen).toBe(true);
  });

  test("no-op when already in desired state", () => {
    const state = makeState({ shopUnits: [makeShopSlot("rat", true)] });
    const result = executeFreeze(state, true, 0, true);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(state);
  });

  test("fails on empty slot", () => {
    const state = makeState({ shopUnits: [null] });
    const result = executeFreeze(state, true, 0, true);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_TARGET");
  });

  test("fails on out-of-bounds unit index", () => {
    const state = makeState({ shopUnits: [makeShopSlot()] });
    const result = executeFreeze(state, true, 5, true);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_INDEX");
  });

  test("fails on out-of-bounds item index", () => {
    const state = makeState({ shopItems: [makeItemSlot()] });
    const result = executeFreeze(state, false, 5, true);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_INDEX");
  });
});

describe("executeSwap", () => {
  test("swaps two units", () => {
    const state = makeState({
      board: [makeBoardUnit("rat"), makeBoardUnit("bat"), null, null, null],
    });
    const result = executeSwap(state, 0, 1);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.board[0]!.id).toBe("bat");
    expect(next.board[1]!.id).toBe("rat");
  });

  test("grafts same-id units on swap", () => {
    const unit0 = makeBoardUnit("rat");
    const unit1 = makeBoardUnit("rat");
    const state = makeState({
      board: [unit0, unit1, null, null, null],
    });
    const result = executeSwap(state, 0, 1);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.board[0]).toBeNull();
    expect(next.board[1]!.atk).toBeGreaterThan(unit1.atk);
  });

  test("fails on empty from-slot", () => {
    const state = makeState();
    const result = executeSwap(state, 0, 1);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_TARGET");
  });

  test("same index returns state unchanged", () => {
    const state = makeState({
      board: [makeBoardUnit("rat"), null, null, null, null],
    });
    const result = executeSwap(state, 0, 0);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(state);
  });
});

describe("executeCultist", () => {
  test("non-cultist origin fails", () => {
    const state = makeState();
    const result = executeCultist(state, null);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("PRECONDITION_FAILED");
  });

  test("already used fails", () => {
    const state = makeState({ cultistUsed: true });
    const result = executeCultist(state, "cultist");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("PRECONDITION_FAILED");
  });

  test("deducts 1 sanity, adds 3 blood", () => {
    const state = makeState({ blood: 5, sanity: 3 });
    const result = executeCultist(state, "cultist");
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.sanity).toBe(2);
    expect(next.blood).toBe(8);
    expect(next.cultistUsed).toBe(true);
  });

  test("insufficient sanity fails", () => {
    const state = makeState({ sanity: 0 });
    const result = executeCultist(state, "cultist");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INSUFFICIENT_RESOURCE");
  });
});

describe("executeDismissEvent", () => {
  test("clears activeEvent", () => {
    const state = makeState({
      activeEvent: {
        bloodBonus: 0,
        freeRoll: false,
        lockRoll: false,
        replacesShopUnits: false,
        shopSizeModifier: 0,
        shopUnitBuff: null,
        itemOffers: [],
        unitOffers: [],
      } as any,
    });
    const result = executeDismissEvent(state, null);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().activeEvent).toBeNull();
  });

  test("reverts blood bonus", () => {
    const state = makeState({
      blood: 13,
      activeEvent: {
        bloodBonus: 3,
        freeRoll: false,
        lockRoll: false,
        replacesShopUnits: false,
        shopSizeModifier: 0,
        shopUnitBuff: null,
        itemOffers: [],
        unitOffers: [],
      } as any,
    });
    const result = executeDismissEvent(state, null);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().blood).toBe(10);
  });

  test("thief gets freeRoll after dismiss", () => {
    const state = makeState({
      activeEvent: {
        bloodBonus: 0,
        freeRoll: false,
        lockRoll: false,
        replacesShopUnits: false,
        shopSizeModifier: 0,
        shopUnitBuff: null,
        itemOffers: [],
        unitOffers: [],
      } as any,
    });
    const result = executeDismissEvent(state, "thief");
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().freeRoll).toBe(true);
  });

  test("fails when no event active", () => {
    const state = makeState();
    const result = executeDismissEvent(state, null);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("PRECONDITION_FAILED");
  });
});

describe("executeUndo", () => {
  test("restores snapshot values", () => {
    const snapshot = {
      blood: 10,
      board: [null, null, null, null, null] as (BoardUnit | null)[],
      shopUnits: [makeShopSlot()] as (ShopSlotJson | null)[],
      shopItems: [] as (ShopItemSlotJson | null)[],
      freeRoll: false,
      cultistUsed: false,
      rotRingUses: 0,
      activeEvent: null,
      rngS0: 123,
      rngS1: 456,
      sanity: 5,
    };
    const state = makeState({ blood: 7, undoSnapshot: snapshot });
    const result = executeUndo(state);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.blood).toBe(10);
    expect(next.rngS0).toBe(123);
    expect(next.undoSnapshot).toBeNull();
  });

  test("fails when no snapshot", () => {
    const state = makeState();
    const result = executeUndo(state);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("PRECONDITION_FAILED");
  });
});

describe("executeReady", () => {
  test("returns finalBoard with end-of-turn effects applied", () => {
    const state = makeState({
      board: [makeBoardUnit("rat"), null, null, null, null],
    });
    const result = executeReady(state);
    expect(result.isOk()).toBe(true);
    const { finalBoard } = result._unsafeUnwrap();
    expect(finalBoard[0]).not.toBeNull();
    expect(finalBoard[0]!.id).toBe("rat");
  });

  test("fails on empty board", () => {
    const state = makeState();
    const result = executeReady(state);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("PRECONDITION_FAILED");
  });

  test("clears undoSnapshot", () => {
    const state = makeState({
      board: [makeBoardUnit("rat"), null, null, null, null],
      undoSnapshot: {
        blood: 10,
        board: [null, null, null, null, null],
        shopUnits: [],
        shopItems: [],
        freeRoll: false,
        cultistUsed: false,
        rotRingUses: 0,
        activeEvent: null,
        rngS0: 1,
        rngS1: 2,
        sanity: 5,
      },
    });
    const result = executeReady(state);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().state.undoSnapshot).toBeNull();
  });
});
