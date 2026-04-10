import type { Buff, Scaled } from "./skill-params";
import type { UnitId } from "./types";

type SN = Scaled<number>;
type SB = Scaled<Buff>;

export const ALTAR = {
  buff: [
    { atk: 3, hp: 1 },
    { atk: 6, hp: 2 },
    { atk: 9, hp: 3 },
  ] as SB,
};

export const MACHINE = {
  buff: [
    { atk: 2, hp: 2 },
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
  ] as SB,
};

export const ZEALOT = {
  summonBuff: [1, 2, 3] as SN,
};

export const ROT_RING = {
  uses: [4, 5, 6] as SN,
};

export const BLOOD_FONT = {
  hpBuff: [3, 5, 7] as SN,
};

export const CORPSE_GARDEN = {
  buff: [
    { atk: 3, hp: 3 },
    { atk: 5, hp: 5 },
    { atk: 7, hp: 7 },
  ] as SB,
};

export const BONE_TREE = {
  buff: [
    { atk: 1, hp: 0 },
    { atk: 1, hp: 1 },
    { atk: 2, hp: 1 },
  ] as SB,
};

export const GRAVE_WORM = {
  sellBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const MARKET_VULTURE = {
  shopBuff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 1 },
    { atk: 2, hp: 2 },
  ] as SB,
};

export const ASH_FUNGUS = {
  percent: [25, 33, 50] as SN,
};

/** 売却時の血液獲得量（レベル + beggarボーナス） */
export function sellBloodGain(level: number, id: UnitId): number {
  return level + (id === "beggar" ? 1 : 0);
}
