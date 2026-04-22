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
 * team全体の接合回数予算。
 *
 * 実ゲームの blood経済から導出:
 *   - UNIT_COST=3、Night 1-2 はロール優先、Night 3以降は購入/売却のサイクル。
 *   - 平均購入量は PURCHASES_PER_NIGHT (0.6) × night 相当だが、半分程度は team入替や
 *     アイテム購入に消費されるため、接合に回るのは更に少ない。
 *   - 経験則: 5体のteamが全員Lv2に到達するには最低 2×5 = 10graft必要で、これは現実の
 *     プレイでは Night 18 でも達成困難。
 *
 * 曲線: `(night - 1) × 0.55` (Night 3≒1, 7≒3, 12≒6, 15≒7, 18≒9)
 */
function teamGraftCap(night: number): number {
  return Math.max(0, Math.floor((night - 1) * 0.55));
}

/**
 * Night進行を統計的に近似したユニット状態を生成する(単体API、後方互換用)。
 *
 * team全体の予算制約を無視するため、`buildProgressedTeam` の利用を推奨。
 * 本関数は個別ユニットの独立サンプリングしか行わず、Lv2/Lv3達成コストが
 * team他ユニットのgraft予算を食うモデルを表現できない。
 */
export function buildProgressedUnit(id: DataUnitId, night: number, rng: Rng): UnitInstance {
  const base = createUnit(id);
  const tier = base.tier as Tier;
  const nightsSinceAvailable = Math.max(0, night - TIER_APPEAR_NIGHT[tier] + 1);
  if (nightsSinceAvailable <= 1) return base;
  const expectedGrafts = Math.min((nightsSinceAvailable - 1) / 3, MAX_UNIT_LEVEL + 2);
  const grafts = poissonCapped(expectedGrafts, CUMULATIVE_EXP[3], rng);
  return applyProgressionToUnit(base, grafts, nightsSinceAvailable, rng);
}

function applyProgressionToUnit(
  base: UnitInstance,
  grafts: number,
  nightsSinceAvailable: number,
  rng: Rng,
): UnitInstance {
  const exp = Math.min(grafts, CUMULATIVE_EXP[3]);
  const level = computeLevel(exp);
  const { newAtk, newHp, buffAtk, buffHp } = computeProgressedStats(
    base.baseAtk,
    base.baseHp,
    grafts,
    nightsSinceAvailable,
    rng,
  );
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
    skillText: getSkillText(base.id as DataUnitId, level),
  };
}

/**
 * team全体として接合予算を分配してユニット群を生成する。
 *
 * 各ユニットのPoissonサンプリング結果の総和が `teamGraftCap(night)` を超える場合、
 * 比例縮小して予算内に収める(残余はbuff蓄積として `computeProgressedStats` に渡る)。
 *
 * これにより「team 5体全員が Lv2 達成」を自動的に抑制し、
 * 継続発動型ショップスキルの Lv2条件/Lv3友条件が実プレイに近い頻度になる。
 */
export function buildProgressedTeam(
  ids: readonly DataUnitId[],
  night: number,
  rng: Rng,
): UnitInstance[] {
  const bases = ids.map((id) => createUnit(id));
  const nightsArr = bases.map((b) => Math.max(0, night - TIER_APPEAR_NIGHT[b.tier as Tier] + 1));
  const rawGrafts = nightsArr.map((nsa) => {
    if (nsa <= 1) return 0;
    const expected = Math.min((nsa - 1) / 3, MAX_UNIT_LEVEL + 2);
    return poissonCapped(expected, CUMULATIVE_EXP[3], rng);
  });

  const total = rawGrafts.reduce((s, g) => s + g, 0);
  const cap = teamGraftCap(night);
  const scaledGrafts =
    total <= cap
      ? rawGrafts
      : rawGrafts.map((g) => (g === 0 ? 0 : Math.min(g, Math.floor((g * cap) / total))));

  return bases.map((b, i) => {
    const nsa = nightsArr[i]!;
    if (nsa <= 1) return b;
    return applyProgressionToUnit(b, scaledGrafts[i]!, nsa, rng);
  });
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
