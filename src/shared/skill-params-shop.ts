import type { Buff, Scaled } from "./skill-params";
import type { ItemId, UnitId } from "./types";

type SN = Scaled<number>;
type SB = Scaled<Buff>;

export const ALTAR = {
  buff: [
    { atk: 1, hp: 2 },
    { atk: 2, hp: 4 },
    { atk: 3, hp: 6 },
  ] as SB,
  requiredFriendLevel: 3,
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

export const CAT = {
  uses: [2, 2, 2] as SN,
  multPerCat: [1, 2, 3] as SN,
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
    // Lv3では能力なし。Scaled<Buff> 3要素規約のプレースホルダー
    { atk: 0, hp: 0 },
  ] as SB,
  targets: 2,
};

/** catacomb_rat: Start turn – 前夜敗北なら前方3体にATKバフ */
export const CATACOMB_RAT = {
  targets: 3,
  atkBuff: [1, 2, 3] as SN,
};

/** graft_scion: Turn start – アイテム補充 */
export const GRAFT_SCION = {
  itemId: ["worm_apple", "worm_apple_2", "worm_apple_3"] as Scaled<ItemId>,
};

export const ASH_FUNGUS = {
  buff: [1, 2, 3] as SN,
  targets: 2,
  minLevel: 2,
};

export const MACHINE = {
  discount: [1, 2, 3] as SN,
};

export const TAINTED_PLACENTA = {
  bloodGain: [1, 2, 3] as SN,
};

export const CORPSE_BROKER = {
  hpBuff: [1, 2, 3] as SN,
  maxUses: 3,
};

export const CHALICE = {
  itemId: ["pure_blood", "pure_blood_2", "pure_blood_3"] as Scaled<ItemId>,
  buff: [
    { atk: 1, hp: 2 },
    { atk: 2, hp: 4 },
    { atk: 3, hp: 6 },
  ] as SB,
};

/** hanged_man: Turn end – 最前の味方に buff */
export const HANGED_MAN = {
  buff: [
    { atk: 2, hp: 2 },
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
  ] as SB,
};

/** plague_bell: 自身が薬を投与された時 – ランダム味方2体に buff */
export const PLAGUE_BELL = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
  targets: 2,
};

/** wailing_cursechild: 味方召喚時 – その味方に buff */
export const WAILING_CURSECHILD = {
  buff: [
    { atk: 3, hp: 1 },
    { atk: 6, hp: 2 },
    { atk: 9, hp: 3 },
  ] as SB,
};

/** 売却時の血液獲得量（beggar は 2×レベル、他はレベル） */
export function sellBloodGain(level: number, id: UnitId): number {
  return level + (id === "beggar" ? level : 0);
}
