import type { Buff, Scaled } from "./skill-params";
import type { ItemId, UnitId } from "./types";

type SN = Scaled<number>;
type SB = Scaled<Buff>;

export const ALTAR = {
  buff: [
    { atk: 3, hp: 1 },
    { atk: 5, hp: 2 },
    { atk: 7, hp: 3 },
  ] as SB,
};

export const ZEALOT = {
  summonBuff: [1, 2, 3] as SN,
};

export const ROT_RING = {
  uses: [4, 4, 4] as SN,
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const BLOOD_FONT = {
  hpBuff: [3, 5, 7] as SN,
};

export const BUDDING_HYDRA = {
  divisor: [5, 4, 3] as SN,
  token: [
    { atk: 3, hp: 3 },
    { atk: 4, hp: 4 },
    { atk: 5, hp: 5 },
  ] as SB,
};

export const BONE_TREE = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
  uses: [3, 4, 5] as SN,
};

export const GUT_HAND = {
  targets: [1, 2, 3] as SN,
  hpBuff: 1,
};

export const BONE_JAW = {
  atkBuff: [1, 2, 3] as SN,
  targets: 2,
};

export const ROT_FEEDER = {
  hpBuff: [1, 2, 3] as SN,
};

export const CORPSE_PECKER = {
  breadCrumbs: [1, 2, 3] as SN,
};

export const NESTING_GRUB = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    // SAP Fish Lv3 準拠: Lv3では能力なし。Scaled<Buff> 3要素規約のプレースホルダー
    { atk: 0, hp: 0 },
  ] as SB,
  targets: 2,
};

export const MARKET_VULTURE = {
  shopBuff: [
    { atk: 1, hp: 0 },
    { atk: 1, hp: 1 },
    { atk: 1, hp: 1 },
  ] as SB,
};

export const ASH_FUNGUS = {
  percent: [20, 35, 50] as SN,
};

export const TAINTED_PLACENTA = {
  shopBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const CORPSE_BROKER = {
  sellBuff: [
    { atk: 1, hp: 0 },
    { atk: 1, hp: 1 },
    { atk: 2, hp: 1 },
  ] as SB,
};

export const CHALICE = {
  itemId: ["pure_blood", "pure_blood_2", "pure_blood_3"] as Scaled<ItemId>,
  buff: [
    { atk: 1, hp: 2 },
    { atk: 2, hp: 4 },
    { atk: 3, hp: 6 },
  ] as SB,
};

/** 売却時の血液獲得量（beggar は 2×レベル、他はレベル） */
export function sellBloodGain(level: number, id: UnitId): number {
  return level + (id === "beggar" ? level : 0);
}
