import type { MAX_UNIT_LEVEL } from "./constants";
import { invariant } from "./invariant";

type Tuple<T, N extends number, R extends T[] = []> = R["length"] extends N
  ? readonly [...R]
  : Tuple<T, N, [T, ...R]>;

/** MAX_UNIT_LEVEL 要素のタプル。要素数は MAX_UNIT_LEVEL から自動導出 */
export type Scaled<T> = Tuple<T, typeof MAX_UNIT_LEVEL>;

export function atLevel<T>(values: Scaled<T>, level: number): T {
  invariant(level >= 1 && level <= values.length, `atLevel: level ${level} out of range`);
  return values[level - 1]!;
}

export type Buff = { readonly atk: number; readonly hp: number };
type SN = Scaled<number>;
type SB = Scaled<Buff>;

// ── 開戦スキル ──

export const BAT = {
  damage: [1, 1, 1] as SN, // targets がスケールするためダメージは固定
  targets: [1, 2, 3] as SN,
};

export const INQUISITOR = {
  damage: [1, 2, 3] as SN,
};

export const BANSHEE = {
  damage: [6, 12, 18] as SN,
  selfDamage: [3, 6, 9] as SN,
};

export const REVENANT = {
  targets: [3, 4, 5] as SN,
  buff: [1, 2, 3] as SN,
};

export const CATACOMB_RAT = {
  tierMult: [1, 2, 3] as SN,
};

export const PALADIN = {
  hpBuff: [1, 2, 3] as SN,
};

export const HOLY_FIRE = {
  damage: [10, 15, 20] as SN,
};

// ── 攻撃前スキル ──

export const CHOLERA = {
  uses: [1, 2, 3] as SN,
};

export const PARASITE = {
  buff: [
    { atk: 2, hp: 2 },
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
  ] as SB,
};

export const EYE = {
  damage: [4, 8, 12] as SN,
  uses: [4, 6, 8] as SN,
};

export const RELIC_SWORD = {
  atkBuff: [2, 4, 6] as SN,
};

export const PLAGUE_BELL = {
  damage: [1, 1, 1] as SN, // AoE + uses がスケールするためダメージは固定
  uses: [4, 6, 8] as SN,
};

// ── 被弾スキル ──

export const TUMOR_GUARDIAN = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

export const TEMPLAR = {
  atkBuff: [1, 2, 3] as SN,
};

export const LEECH = {
  hpBuff: [1, 2, 3] as SN,
};

export const STITCHED_TWIN = {
  atkBuff: [2, 3, 4] as SN,
};

export const FLAYED_SAINT = {
  damage: [2, 4, 6] as SN,
};

export const FLAGELLANT = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 1 },
    { atk: 2, hp: 2 },
  ] as SB,
};

export const HOWLING_GIANT = {
  atkBuff: [1, 2, 3] as SN,
};

export const AMNIOTIC_ARMOR = {
  uses: [2, 3, 4] as SN,
};

export const MACHINE = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 1, hp: 2 },
    { atk: 2, hp: 2 },
  ] as SB,
  uses: [3, 3, 3] as SN,
};

// ── 戦闘スキル（撃破） ──

export const DEAD_HAND = {
  hpHeal: [1, 2, 3] as SN,
};

export const DEVOURING_WOUND = {
  hpHeal: [2, 3, 4] as SN,
};

export const HUNDRED_ARMS = {
  damageT1: [8, 16, 24] as SN,
  damageDefault: [3, 6, 9] as SN,
};

export const ORGAN_GRINDER = {
  damage: [2, 4, 6] as SN,
};

export const RISEN_POPE = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

// ── 死亡スキル ──
export {
  RAT,
  SQUIRE,
  MARTYR,
  PRIEST,
  HOUND,
  BEAST,
  CHURCH_BEAST,
  HANGED_MAN,
  SERAPH,
  EVANGELIST,
  CROW,
  SIN_EATER,
  CATHEDRAL,
  BEELZEBUB,
  OMEN_WOMB,
  STELLAR_COCOON,
} from "./skill-params-death";

// ── Avengeスキル ──

export const CHARNEL_PIT = {
  threshold: 2,
  token: [
    { atk: 3, hp: 3 },
    { atk: 5, hp: 5 },
    { atk: 7, hp: 7 },
  ] as SB,
};

export const GRINNING_SKULL = {
  threshold: 3,
  buff: [
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
    { atk: 5, hp: 5 },
  ] as SB,
};

export const ARCHANGEL = {
  threshold: 2,
  buff: [
    { atk: 4, hp: 4 },
    { atk: 6, hp: 6 },
    { atk: 8, hp: 8 },
  ] as SB,
};

export const GROANING_COFFIN = {
  threshold: 2,
  damage: [3, 5, 7] as SN,
};

export const WAILING_CURSECHILD = {
  threshold: 3,
  buff: [
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
    { atk: 4, hp: 4 },
  ] as SB,
};

// ── 味方召喚時 ──

export const FLESH_GRANULATION = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

// ── 開戦バフ ──

export const CORRODING_MOLD = {
  buff: [
    { atk: 1, hp: 1 },
    { atk: 2, hp: 2 },
    { atk: 3, hp: 3 },
  ] as SB,
};

// ── 味方死亡リアクション ──

export const CRAWLING_CORD = {
  buff: [
    { atk: 1, hp: 2 },
    { atk: 2, hp: 3 },
    { atk: 3, hp: 4 },
  ] as SB,
};

export const INSATIABLE_MAW = {
  buff: [
    { atk: 2, hp: 1 },
    { atk: 3, hp: 2 },
    { atk: 4, hp: 2 },
  ] as SB,
};

// ── ショップスキル ──
export {
  ALTAR,
  ZEALOT,
  ROT_RING,
  BLOOD_FONT,
  CORPSE_GARDEN,
  BONE_TREE,
  GRAVE_WORM,
  MARKET_VULTURE,
  ASH_FUNGUS,
  GHOUL_INFANT,
  TAINTED_PLACENTA,
  CORPSE_BROKER,
  sellBloodGain,
} from "./skill-params-shop";
