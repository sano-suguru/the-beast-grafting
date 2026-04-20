import type { UnitInstance, DataUnitId } from "../../shared/types";
import type { EquipType } from "../../shared/equip-type";
import type { Tier } from "../../shared/data/tiers";
import type { Rng } from "../rng";
import { createUnit } from "../helpers";
import { getSkillText } from "../../shared/skill-text";
import { CUMULATIVE_EXP, MAX_UNIT_LEVEL } from "../../shared/constants";
import { TIER_APPEAR_NIGHT } from "./sim-types";

/**
 * Night進行に応じた装備の重みテーブル。
 * infection は敵スキルで付与されるものなのでプレイヤー装備候補から除外。
 */
const EQUIP_WEIGHTS: readonly { type: EquipType; weight: number }[] = [
  { type: "iron_plate", weight: 20 },
  { type: "bile", weight: 20 },
  { type: "corpse_wax", weight: 12 },
  { type: "acid_blood", weight: 12 },
  { type: "numbness", weight: 8 },
  { type: "maggot", weight: 8 },
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
 * nightsSinceAvailable = night - TIER_APPEAR_NIGHT[tier] + 1 を基盤にする。
 * 高Tierユニットはそのティアが解放されてから日が浅いため、
 * 接合回数・装備確率・バフ蓄積がいずれも低く抑えられる。
 *
 * 接合ステータス計算は実装（graftUnits）に近い形で近似する:
 * - 接合間に蓄積したバフが接合で baseAtk/baseHp に焼き込まれ、buff はリセットされる
 * - 最後の接合以降に蓄積したバフのみが buffAtk/buffHp として残る
 */
export function buildProgressedUnit(id: DataUnitId, night: number, rng: Rng): UnitInstance {
  const base = createUnit(id);
  const tier = base.tier as Tier;
  const nightsSinceAvailable = Math.max(0, night - TIER_APPEAR_NIGHT[tier] + 1);

  // Tierが解放されたばかり（0〜1夜）はベースステータスそのまま
  if (nightsSinceAvailable <= 1) return base;

  // 接合回数: Tier出現からの経過夜数に比例、最大5（Lv3到達に必要な上限）
  const expectedGrafts = Math.min((nightsSinceAvailable - 1) / 3, MAX_UNIT_LEVEL + 2);
  const grafts = poissonCapped(expectedGrafts, CUMULATIVE_EXP[3], rng);

  const exp = Math.min(grafts, CUMULATIVE_EXP[3]);
  const level = computeLevel(exp);

  // 接合とバフ蓄積を時系列で近似（バフが接合に焼き込まれる挙動を再現）
  const { newAtk, newHp, buffAtk, buffHp } = computeProgressedStats(
    base.baseAtk,
    base.baseHp,
    grafts,
    nightsSinceAvailable,
    rng,
  );

  // 装備: Tier出現からの経過夜数に基づいて確率を設定
  const equipChance = Math.min(0.7, (nightsSinceAvailable - 1) * 0.1);
  const equip = rng.next() < equipChance ? pickEquip(rng) : null;

  return {
    ...base,
    baseAtk: newAtk,
    baseHp: newHp,
    buffAtk,
    buffHp,
    tempBuffAtk: 0,
    level,
    exp,
    equip,
    skillText: getSkillText(id, level),
  };
}

/**
 * 接合とバフ蓄積の時系列を近似してステータスを算出する。
 *
 * 実ゲームでの接合: max(effectiveAtk(base), effectiveAtk(material)) + 1、buffはリセット。
 * simでは素材を「同一ユニットの新品（buffなし）」と仮定するため、
 * effectiveAtk(base) >= effectiveAtk(material) が常に成立する。
 *
 * nightsSinceAvailable を (grafts+1) 等分し、各区間でバフを蓄積してから接合する。
 * 最終区間のバフが buffAtk/buffHp として残る。
 */
function computeProgressedStats(
  startAtk: number,
  startHp: number,
  grafts: number,
  nightsSinceAvailable: number,
  rng: Rng,
): { newAtk: number; newHp: number; buffAtk: number; buffHp: number } {
  if (grafts === 0) {
    // 接合なし: バフ蓄積のみ
    const buffPool = Math.floor(rng.next() * nightsSinceAvailable * 0.5);
    const ba = Math.floor(rng.next() * (buffPool + 1));
    return { newAtk: startAtk, newHp: startHp, buffAtk: ba, buffHp: buffPool - ba };
  }

  // nightsSinceAvailable を (grafts+1) 等分
  // 各区間の期待バフ(/ステータス): intervalLength * 0.125
  //   (rng.next() の期待値 0.5 × 0.5 night係数 / 2ステータス = 0.125)
  const intervalLength = nightsSinceAvailable / (grafts + 1);
  const buffPerIntervalStat = intervalLength * 0.125;

  let curAtk = startAtk;
  let curHp = startHp;

  for (let g = 0; g < grafts; g++) {
    // 接合: 蓄積バフが baseAtk に焼き込まれ +1、buff はリセット
    curAtk = Math.floor(curAtk + buffPerIntervalStat + 1);
    curHp = Math.floor(curHp + buffPerIntervalStat + 1);
  }

  // 最終区間（最後の接合以降）のバフが buff として残る
  const remainPool = Math.floor(rng.next() * intervalLength * 0.5);
  const ba = Math.floor(rng.next() * (remainPool + 1));
  return { newAtk: curAtk, newHp: curHp, buffAtk: ba, buffHp: remainPool - ba };
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
