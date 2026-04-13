export { UNIT_COST } from "../shared/constants";

export const DEATH_CASCADE_LIMIT = 20;
export const CLASH_LIMIT = 500;
/** 無限ループ防止用安全上限。死亡アニメフレーム等の視覚フレームを含め余裕を持たせる */
export const MAX_OPS = 15_000;
export const FLY_SPAWN_CAP = 3;
export const HUNDRED_ARMS_SAFETY = 10;
/** SAP準拠: 攻撃前スキルは前衛の直後（support位置）のみ発動 */
export const SUPPORT_IDX = 1;

// ── 装備効果（レベル非依存） ──
export const ACID_SPLASH_DAMAGE = 5;
export const MAGGOT_TOKEN = { atk: 1, hp: 1 } as const;
export const DEATH_CURSE_TOKEN = { atk: 1, hp: 1 } as const;
export const BERSERK_BONUS = 3;
export const INFECTION_EXTRA_DAMAGE = 3;
export const NUMBNESS_REDUCTION = 7;
export const NUMBNESS_INITIAL_USES = 2;
export const CORPSE_WAX_REDUCTION = 20;
export const IRON_REDUCTION = 2;
export const MIN_EQUIPMENT_DAMAGE = 2;
export const ROTTING_CARGO_CEILING_BONUS = { atk: 2, hp: 2 } as const;

export const MAX_BOARD_SIZE = 5;

export const FRAME_DELAY_DEATH_CHAIN = 300;

export const SHOP_SIZES = [
  { minNight: 9, size: 5 },
  { minNight: 5, size: 4 },
] as const;
export const SHOP_SIZE_DEFAULT = 3;

export const ITEM_SHOP_SIZES = [{ minNight: 7, size: 2 }] as const;
export const ITEM_SHOP_SIZE_DEFAULT = 1;

export const LEVEL_UP_REWARD_COUNT = 2;
