vi.mock("../engine/audio", () => ({
  initAudio: vi.fn(),
  playSE: vi.fn(),
}));

import {
  setupNight,
  rollShop,
  handleFreezeClick,
  executeSellUnit,
  useCultistAbility,
} from "./shop-actions";
import {
  origin,
  blood,
  round,
  board,
  freeRoll,
  cultistUsed,
  sanity,
  selection,
  shopUnits,
  shopItems,
  currentEnemyTeam,
  onboardingStep,
} from "./game-store";
import { makeUnit } from "../engine/test-helpers";

beforeEach(() => {
  origin.value = null;
  blood.value = 10;
  round.value = 1;
  board.value = [null, null, null, null, null];
  freeRoll.value = false;
  cultistUsed.value = false;
  sanity.value = 5;
  selection.value = null;
  shopUnits.value = [];
  shopItems.value = [];
  currentEnemyTeam.value = null;
  onboardingStep.value = null;
});

describe("setupNight – basic setup", () => {
  it("sets blood to 10", () => {
    blood.value = 3;
    setupNight(1, "thief", true);
    expect(blood.value).toBe(10);
  });

  it("generates enemy team", () => {
    setupNight(1, "thief", true);
    expect(currentEnemyTeam.value).not.toBeNull();
  });

  it("resets cultistUsed", () => {
    cultistUsed.value = true;
    setupNight(1, null, false);
    expect(cultistUsed.value).toBe(false);
  });

  it("clears selection", () => {
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    setupNight(1, null, false);
    expect(selection.value).toBeNull();
  });
});

describe("setupNight – origin effects", () => {
  it("sets freeRoll for thief origin", () => {
    setupNight(1, "thief", true);
    expect(freeRoll.value).toBe(true);
  });

  it("does not set freeRoll for non-thief origin", () => {
    setupNight(1, "surgeon", true);
    expect(freeRoll.value).toBe(false);
  });

  it("inquisitor upgrades one shop unit to higher tier on initial setup", () => {
    setupNight(1, "inquisitor", true);
    const units = shopUnits.value.filter(Boolean);
    const tiers = units.map((s) => s!.unit.tier);
    expect(tiers.some((t) => t === 2)).toBe(true);
  });

  it("inquisitor upgrades one shop unit on subsequent nights", () => {
    setupNight(3, "inquisitor", false);
    const units = shopUnits.value.filter(Boolean);
    const tiers = units.map((s) => s!.unit.tier);
    const maxTierInPool = 2;
    expect(tiers.some((t) => t > maxTierInPool || t === 2)).toBe(true);
  });

  it("non-inquisitor does not get tier upgrade", () => {
    setupNight(1, "thief", true);
    const units = shopUnits.value.filter(Boolean);
    const tiers = units.map((s) => s!.unit.tier);
    expect(tiers.every((t) => t === 1)).toBe(true);
  });
});

describe("setupNight – initial shop generation", () => {
  it("generates initial shop with specific units (rat, rat, bat)", () => {
    setupNight(1, "thief", true);
    const units = shopUnits.value.filter(Boolean);
    expect(units).toHaveLength(3);
    expect(units[0]!.unit.id).toBe("rat");
    expect(units[1]!.unit.id).toBe("rat");
    expect(units[2]!.unit.id).toBe("bat");
  });
});

describe("rollShop", () => {
  beforeEach(() => {
    setupNight(1, "thief", true);
  });

  it("costs 1 blood when no free roll", () => {
    freeRoll.value = false;
    blood.value = 10;
    rollShop();
    expect(blood.value).toBe(9);
  });

  it("does not cost blood on free roll", () => {
    freeRoll.value = true;
    blood.value = 10;
    rollShop();
    expect(blood.value).toBe(10);
  });

  it("consumes freeRoll", () => {
    freeRoll.value = true;
    rollShop();
    expect(freeRoll.value).toBe(false);
  });

  it("does not roll when no blood and no free roll", () => {
    freeRoll.value = false;
    blood.value = 0;
    const prevUnits = shopUnits.value;
    rollShop();
    expect(shopUnits.value).toBe(prevUnits);
  });

  it("clears selection", () => {
    selection.value = { type: "SHOP_UNIT", index: 0, item: makeUnit() };
    rollShop();
    expect(selection.value).toBeNull();
  });

  it("advances onboardingStep from roll to battle", () => {
    onboardingStep.value = "roll";
    rollShop();
    expect(onboardingStep.value).toBe("battle");
  });
});

describe("handleFreezeClick", () => {
  beforeEach(() => {
    setupNight(1, "thief", true);
  });

  it("toggles unit freeze on", () => {
    expect(shopUnits.value[0]!.frozen).toBe(false);
    handleFreezeClick(true, 0);
    expect(shopUnits.value[0]!.frozen).toBe(true);
  });

  it("toggles unit freeze off", () => {
    handleFreezeClick(true, 0);
    handleFreezeClick(true, 0);
    expect(shopUnits.value[0]!.frozen).toBe(false);
  });

  it("toggles item freeze", () => {
    handleFreezeClick(false, 0);
    expect(shopItems.value[0]!.frozen).toBe(true);
  });

  it("clears selection", () => {
    selection.value = { type: "SHOP_UNIT", index: 0, item: makeUnit() };
    handleFreezeClick(true, 0);
    expect(selection.value).toBeNull();
  });

  it("does nothing for null item slot", () => {
    shopItems.value = [null];
    handleFreezeClick(false, 0);
    expect(shopItems.value[0]).toBeNull();
  });
});

describe("executeSellUnit", () => {
  it("gains 1 blood for selling normal unit", () => {
    const unit = makeUnit({ id: "hound" });
    board.value = [unit, null, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unit };
    blood.value = 5;
    executeSellUnit();
    expect(blood.value).toBe(6);
    expect(board.value[0]).toBeNull();
  });

  it("gains 2 blood for selling beggar", () => {
    const beggar = makeUnit({ id: "beggar" });
    board.value = [beggar, null, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: beggar };
    blood.value = 5;
    executeSellUnit();
    expect(blood.value).toBe(7);
  });

  it("does nothing without BOARD_UNIT selection", () => {
    selection.value = null;
    blood.value = 5;
    executeSellUnit();
    expect(blood.value).toBe(5);
  });

  it("does nothing when board slot is empty", () => {
    board.value = [null, null, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: makeUnit() };
    blood.value = 5;
    executeSellUnit();
    expect(blood.value).toBe(5);
  });

  it("surgeon origin buffs a random ally on sell", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    origin.value = "surgeon";
    const unit = makeUnit({ id: "hound" });
    const ally = makeUnit({ atk: 3, hp: 3 });
    board.value = [unit, ally, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unit };
    executeSellUnit();
    expect(board.value[1]!.atk).toBe(4);
    expect(board.value[1]!.hp).toBe(4);
    vi.restoreAllMocks();
  });

  it("clears selection after sell", () => {
    const unit = makeUnit();
    board.value = [unit, null, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unit };
    executeSellUnit();
    expect(selection.value).toBeNull();
  });

  it("surgeon origin: selling last unit still updates board and clears selection", () => {
    origin.value = "surgeon";
    const unit = makeUnit({ id: "hound" });
    board.value = [unit, null, null, null, null];
    selection.value = { type: "BOARD_UNIT", index: 0, item: unit };
    blood.value = 5;
    executeSellUnit();
    expect(board.value[0]).toBeNull();
    expect(selection.value).toBeNull();
    expect(blood.value).toBe(6);
  });
});

describe("useCultistAbility", () => {
  it("trades 1 sanity for 3 blood", () => {
    origin.value = "cultist";
    sanity.value = 5;
    blood.value = 5;
    useCultistAbility();
    expect(sanity.value).toBe(4);
    expect(blood.value).toBe(8);
  });

  it("sets cultistUsed to true", () => {
    origin.value = "cultist";
    sanity.value = 5;
    useCultistAbility();
    expect(cultistUsed.value).toBe(true);
  });

  it("does nothing for non-cultist origin", () => {
    origin.value = "thief";
    sanity.value = 5;
    blood.value = 5;
    useCultistAbility();
    expect(blood.value).toBe(5);
  });

  it("does nothing when already used", () => {
    origin.value = "cultist";
    cultistUsed.value = true;
    sanity.value = 5;
    blood.value = 5;
    useCultistAbility();
    expect(blood.value).toBe(5);
  });

  it("does nothing when sanity < 1", () => {
    origin.value = "cultist";
    sanity.value = 0;
    blood.value = 5;
    useCultistAbility();
    expect(blood.value).toBe(5);
  });

  it("succeeds when sanity = 1", () => {
    origin.value = "cultist";
    sanity.value = 1;
    blood.value = 5;
    useCultistAbility();
    expect(blood.value).toBe(8);
    expect(sanity.value).toBe(0);
  });
});
