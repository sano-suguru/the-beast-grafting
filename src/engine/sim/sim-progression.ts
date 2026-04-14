import type { UnitInstance, DataUnitId } from "../../shared/types";
import type { EquipType } from "../../shared/equip-type";
import type { Rng } from "../rng";
import { createUnit } from "../helpers";
import { getSkillText } from "../../shared/skill-text";
import { CUMULATIVE_EXP, MAX_UNIT_LEVEL } from "../../shared/constants";

/**
 * Night進行に応じた装備の重みテーブル。
 * infection は敵スキルで付与されるものなのでプレイヤー装備候補から除外。
 */
const EQUIP_WEIGHTS: readonly { type: EquipType; weight: number }[] = [
  { type: "iron", weight: 20 },
  { type: "berserk", weight: 20 },
  { type: "corpse_wax", weight: 12 },
  { type: "acid", weight: 12 },
  { type: "numbness", weight: 8 },
  { type: "maggot_nest", weight: 8 },
  { type: "death_curse", weight: 8 },
];

const TOTAL_EQUIP_WEIGHT = EQUIP_WEIGHTS.reduce((s, e) => s + e.weight, 0);

function pickEquip(rng: Rng): EquipType {
  let r = rng.next() * TOTAL_EQUIP_WEIGHT;
  for (const { type, weight } of EQUIP_WEIGHTS) {
    r -= weight;
    if (r <= 0) return type;
  }
  return EQUIP_WEIGHTS[EQUIP_WEIGHTS.length - 1]!.type;
}

function computeLevel(exp: number): number {
  if (exp >= CUMULATIVE_EXP[3]) return 3;
  if (exp >= CUMULATIVE_EXP[2]) return 2;
  return 1;
}

/**
 * Night進行を統計的に近似したユニット状態を生成する。
 *
 * 実ゲームのショップ経済をフルシミュレートせず、
 * 「Night N での典型的なユニット状態」を確率的に生成する:
 *
 * - レベル: Night が進むほど接合回数(exp)が増える
 * - ステータス: 接合1回につき +1/+1（同一ユニット接合の最小ゲイン）
 * - 装備: Night 3以降、確率的に装備を割り当て
 * - ショップバフ: Night に比例した蓄積バフ
 */
export function buildProgressedUnit(id: DataUnitId, night: number, rng: Rng): UnitInstance {
  const base = createUnit(id);
  if (night <= 2) return base;

  // 接合回数: 平均 (night-1)/3 回、最大5 (Lv3到達)
  const expectedGrafts = Math.min((night - 1) / 3, MAX_UNIT_LEVEL + 2);
  const grafts = poissonCapped(expectedGrafts, CUMULATIVE_EXP[3], rng);

  const exp = Math.min(grafts, CUMULATIVE_EXP[3]);
  const level = computeLevel(exp);

  // 接合ごとに +1/+1
  const statBonus = grafts;
  const newAtk = base.baseAtk + statBonus;
  const newHp = base.baseHp + statBonus;

  // 装備: Night 3 以降、確率的に付与
  const equipChance = Math.min(0.7, (night - 2) * 0.1);
  const equip = rng.next() < equipChance ? pickEquip(rng) : null;

  // ショップバフ: Night に比例した蓄積（平均 night/4 ずつ atk/hp に分配）
  const buffPool = Math.floor(rng.next() * night * 0.5);
  const buffAtk = Math.floor(rng.next() * (buffPool + 1));
  const buffHp = buffPool - buffAtk;

  return {
    ...base,
    baseAtk: newAtk,
    baseHp: newHp,
    buffAtk,
    buffHp,
    level,
    exp,
    equip,
    skillText: getSkillText(id, level),
  };
}

/** ポアソン分布からのサンプリング（cap付き）。Knuth アルゴリズム */
function poissonCapped(lambda: number, cap: number, rng: Rng): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  while (k < cap) {
    p *= rng.next();
    if (p < L) break;
    k++;
  }
  return k;
}
