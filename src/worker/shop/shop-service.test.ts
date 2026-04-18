import { makeUnit } from "../../engine/test-helpers";
import { invariant } from "../../shared/invariant";
import { createSeededRng } from "../../engine/rng";
import { unitInstanceToBoardUnit } from "../../shared/board-unit";
import type { BoardUnit } from "../../shared/board-unit";
import type { UnitId, EventData } from "../../shared/types";
import { UNIT_COST } from "../../shared/constants";
import { effectiveAtk } from "../../shared/unit-stats";
import { ITEMS } from "../../shared/data/items";
import type { ShopSlotJson, ShopItemSlotJson } from "../../db/shop-state-types";
import type { ShopStateRow } from "./shop-state-row";
import { executeSetup } from "./shop-service";
import { executeRoll, executeBuy, executeBuyReward, executeSell } from "./shop-actions-trade";
import {
  executeEquip,
  executeFreeze,
  executeSwap,
  executeCultist,
  executeUndo,
  executeReady,
} from "./shop-actions";

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
    boneTreeUses: 0,
    activeEvent: null,
    rngS0: s0,
    rngS1: s1,
    rewardSlots: [],
    undoSnapshot: null,
    night: 1,
    life: 5,
    ...overrides,
  };
}

function makeShopSlot(id: string = "rat", frozen = false): ShopSlotJson {
  return {
    unit: unitInstanceToBoardUnit(makeUnit({ id: id as UnitId })),
    frozen,
    eventSourced: false,
  };
}

function makeItemSlot(itemId: string = "preservative", frozen = false): ShopItemSlotJson {
  return { itemId, frozen };
}

function makeBoardUnit(id: string = "rat"): BoardUnit {
  return unitInstanceToBoardUnit(makeUnit({ id: id as UnitId }));
}

describe("executeSetup", () => {
  test("tutorial shop generates rat/rat/bat", () => {
    const result = executeSetup(1, 5, null, 42, [null, null, null, null, null], true, [], []);
    const ids = result.shopUnits.filter(Boolean).map((s) => s!.unit.id);
    expect(ids).toEqual(["rat", "rat", "bat"]);
  });

  test("thief origin gets freeRoll=true", () => {
    const result = executeSetup(1, 5, "thief", 42, [null, null, null, null, null], true, [], []);
    expect(result.freeRoll).toBe(true);
  });

  test("inquisitor upgrades one shop unit tier", () => {
    const results: ReturnType<typeof executeSetup>[] = [];
    for (let i = 1; i <= 20; i++) {
      results.push(
        executeSetup(1, 5, "inquisitor", i, [null, null, null, null, null], true, [], []),
      );
    }
    const hasHigherTier = results.some((r) =>
      r.shopUnits.some((s) => s !== null && s.unit.tier > 1),
    );
    expect(hasHigherTier).toBe(true);
  });

  test("non-tutorial generates shop units appropriate for night", () => {
    const result = executeSetup(3, 5, null, 42, [null, null, null, null, null], false, [], []);
    const nonNull = result.shopUnits.filter(Boolean);
    expect(nonNull.length).toBeGreaterThan(0);
    expect(nonNull.length).toBeLessThanOrEqual(5);
  });

  test("blood starts at 10", () => {
    const result = executeSetup(1, 5, null, 42, [null, null, null, null, null], true, [], []);
    expect(result.blood).toBe(10);
  });

  test("resets tempBuffAtk on prevBoard units", () => {
    const bu = unitInstanceToBoardUnit(makeUnit({ id: "rat", tempBuffAtk: 3 }));
    const result = executeSetup(2, 5, null, 42, [bu, null, null, null, null], false, [], []);
    const unit = result.board[0] as BoardUnit;
    expect(unit.tempBuffAtk).toBe(0);
  });

  test("tainted_placenta on prevBoard buffs one shop unit at turn start", () => {
    const placenta = unitInstanceToBoardUnit(makeUnit({ id: "tainted_placenta" as UnitId }));
    const result = executeSetup(1, 5, null, 42, [placenta, null, null, null, null], true, [], []);
    const totalAtk = result.shopUnits.reduce((sum, s) => sum + (s?.unit.buffAtk ?? 0), 0);
    const totalHp = result.shopUnits.reduce((sum, s) => sum + (s?.unit.buffHp ?? 0), 0);
    expect(totalAtk).toBe(1);
    expect(totalHp).toBe(1);
    const buffedCount = result.shopUnits.filter(
      (s) => s && (s.unit.buffAtk > 0 || s.unit.buffHp > 0),
    ).length;
    expect(buffedCount).toBe(1);
  });

  test("no tainted_placenta on prevBoard does not buff shop units", () => {
    const result = executeSetup(1, 5, null, 42, [null, null, null, null, null], true, [], []);
    const anyBuffed = result.shopUnits.some((s) => s && (s.unit.buffAtk > 0 || s.unit.buffHp > 0));
    expect(anyBuffed).toBe(false);
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
      activeEvent: { lockRoll: true } as EventData,
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
    expect(effectiveAtk(next.board[0]!)).toBeGreaterThan(effectiveAtk(boardUnit));
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
    expect(remaining.buffAtk).toBe(unit1.buffAtk + 1);
    expect(remaining.buffHp).toBe(unit1.buffHp + 1);
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
    expect(next.board[0]!.baseAtk).toBe(unit.baseAtk + item.atk);
    expect(next.board[0]!.baseHp).toBe(unit.baseHp + item.hp);
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
    const result = executeFreeze(state, "unit", 0, true);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().shopUnits[0]!.frozen).toBe(true);
  });

  test("unfreezes a frozen unit", () => {
    const state = makeState({ shopUnits: [makeShopSlot("rat", true)] });
    const result = executeFreeze(state, "unit", 0, false);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().shopUnits[0]!.frozen).toBe(false);
  });

  test("freezes an unfrozen item", () => {
    const state = makeState({ shopItems: [makeItemSlot("preservative", false)] });
    const result = executeFreeze(state, "item", 0, true);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().shopItems[0]!.frozen).toBe(true);
  });

  test("freezes a reward slot", () => {
    const state = makeState({ rewardSlots: [makeShopSlot("rat", false)] });
    const result = executeFreeze(state, "reward", 0, true);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().rewardSlots[0]!.frozen).toBe(true);
  });

  test("no-op when already in desired state", () => {
    const state = makeState({ shopUnits: [makeShopSlot("rat", true)] });
    const result = executeFreeze(state, "unit", 0, true);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap()).toBe(state);
  });

  test("fails on empty slot", () => {
    const state = makeState({ shopUnits: [null] });
    const result = executeFreeze(state, "unit", 0, true);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_TARGET");
  });

  test("fails on out-of-bounds unit index", () => {
    const state = makeState({ shopUnits: [makeShopSlot()] });
    const result = executeFreeze(state, "unit", 5, true);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_INDEX");
  });

  test("fails on out-of-bounds item index", () => {
    const state = makeState({ shopItems: [makeItemSlot()] });
    const result = executeFreeze(state, "item", 5, true);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_INDEX");
  });

  test("fails on out-of-bounds reward index", () => {
    const state = makeState({ rewardSlots: [makeShopSlot()] });
    const result = executeFreeze(state, "reward", 5, true);
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
    expect(effectiveAtk(next.board[1]!)).toBeGreaterThan(effectiveAtk(unit1));
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

  test("deducts 1 life, adds 3 blood", () => {
    const state = makeState({ blood: 5, life: 3 });
    const result = executeCultist(state, "cultist");
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.life).toBe(2);
    expect(next.blood).toBe(8);
    expect(next.cultistUsed).toBe(true);
  });

  test("rejects at life=1 (would die)", () => {
    const state = makeState({ blood: 0, life: 1 });
    const result = executeCultist(state, "cultist");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INSUFFICIENT_RESOURCE");
  });

  test("allows at life=2, resulting in life=1", () => {
    const state = makeState({ blood: 0, life: 2 });
    const result = executeCultist(state, "cultist");
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.life).toBe(1);
    expect(next.blood).toBe(3);
    expect(next.cultistUsed).toBe(true);
  });

  test("insufficient life fails", () => {
    const state = makeState({ life: 0 });
    const result = executeCultist(state, "cultist");
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INSUFFICIENT_RESOURCE");
  });
});

describe("executeBuyReward", () => {
  test("places reward unit on empty board slot", () => {
    const state = makeState({ rewardSlots: [makeShopSlot("rat")] });
    const result = executeBuyReward(state, 0, 0);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(next.blood).toBe(10 - UNIT_COST);
    expect(next.board[0]).not.toBeNull();
    expect(next.board[0]!.id).toBe("rat");
  });

  test("grafts same-id reward unit onto board", () => {
    const boardUnit = makeBoardUnit("rat");
    const state = makeState({
      board: [boardUnit, null, null, null, null],
      rewardSlots: [makeShopSlot("rat")],
    });
    const result = executeBuyReward(state, 0, 0);
    expect(result.isOk()).toBe(true);
    const next = result._unsafeUnwrap();
    expect(effectiveAtk(next.board[0]!)).toBeGreaterThan(effectiveAtk(boardUnit));
  });

  test("fails with INSUFFICIENT_RESOURCE when blood < UNIT_COST", () => {
    const state = makeState({ blood: 1, rewardSlots: [makeShopSlot("rat")] });
    const result = executeBuyReward(state, 0, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INSUFFICIENT_RESOURCE");
  });

  test("fails with INVALID_INDEX for out-of-bounds rewardIndex", () => {
    const state = makeState({ rewardSlots: [makeShopSlot()] });
    const result = executeBuyReward(state, 5, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_INDEX");
  });

  test("fails with INVALID_TARGET for empty reward slot", () => {
    const state = makeState({ rewardSlots: [null] });
    const result = executeBuyReward(state, 0, 0);
    expect(result.isErr()).toBe(true);
    expect(result._unsafeUnwrapErr().type).toBe("INVALID_TARGET");
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
      boneTreeUses: 0,
      activeEvent: null,
      rngS0: 123,
      rngS1: 456,
      life: 5,
      rewardSlots: [],
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

describe("rotting_cargo event", () => {
  function findEventRoundSeed(): number {
    for (let seed = 1; seed <= 200; seed++) {
      const result = executeSetup(4, 5, null, seed, [null, null, null, null, null], false, [], []);
      if (result.activeEvent?.id === "rotting_cargo") return seed;
    }
    invariant(false, "rotting_cargo seed not found");
  }

  test("setup mixes event units into normal shop", () => {
    const seed = findEventRoundSeed();
    const result = executeSetup(4, 5, null, seed, [null, null, null, null, null], false, [], []);
    const allSlots = result.shopUnits.filter(Boolean);
    const eventSlots = allSlots.filter((s) => s!.eventSourced);
    const normalSlots = allSlots.filter((s) => !s!.eventSourced);
    expect(eventSlots).toHaveLength(2);
    expect(normalSlots.length).toBeGreaterThan(0);
    eventSlots.forEach((s) => {
      expect(s!.unit.equip).toBe("infection");
      expect(s!.costOverride).toBe(2);
    });
  });

  test("reroll removes non-frozen event units", () => {
    const seed = findEventRoundSeed();
    const state = executeSetup(4, 5, null, seed, [null, null, null, null, null], false, [], []);
    const rolled = executeRoll(state, null)._unsafeUnwrap();
    const eventSlots = rolled.shopUnits.filter((s) => s?.eventSourced);
    expect(eventSlots).toHaveLength(0);
  });

  test("reroll preserves frozen event units", () => {
    const seed = findEventRoundSeed();
    const state = executeSetup(4, 5, null, seed, [null, null, null, null, null], false, [], []);
    const eventIdx = state.shopUnits.findIndex((s) => s?.eventSourced);
    const frozen = executeFreeze(state, "unit", eventIdx, true)._unsafeUnwrap();
    const rolled = executeRoll(frozen, null)._unsafeUnwrap();
    const eventSlots = rolled.shopUnits.filter((s) => s?.eventSourced);
    expect(eventSlots).toHaveLength(1);
    expect(eventSlots[0]!.frozen).toBe(true);
    expect(eventSlots[0]!.unit.equip).toBe("infection");
  });
});

describe("executeReady", () => {
  test("returns finalBoard with end-of-night effects applied", () => {
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
        boneTreeUses: 0,
        activeEvent: null,
        rngS0: 1,
        rngS1: 2,
        life: 5,
        rewardSlots: [],
      },
    });
    const result = executeReady(state);
    expect(result.isOk()).toBe(true);
    expect(result._unsafeUnwrap().state.undoSnapshot).toBeNull();
  });
});
