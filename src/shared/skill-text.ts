import type { UnitId } from "./types";
import {
  atLevel,
  BAT,
  INQUISITOR,
  BANSHEE,
  REVENANT,
  CHOLERA,
  PARASITE,
  EYE,
  TEMPLAR,
  RAT,
  SQUIRE,
  MARTYR,
  PRIEST,
  HOUND,
  BEAST,
  CHURCH_BEAST,
  EVANGELIST,
  BEELZEBUB,
  ALTAR,
  MACHINE,
  ZEALOT,
  HUNDRED_ARMS,
  ROT_RING,
} from "./skill-params";

const TEMPLATES: Partial<Record<UnitId, (lv: number) => string>> = {
  rat: (lv) => {
    const b = atLevel(RAT.deathBuff, lv);
    return `死亡: 味方1体に+${b.atk}/+${b.hp}`;
  },
  hound: (lv) => {
    const b = atLevel(HOUND.token, lv);
    return `死亡: ${b.atk}/${b.hp}頭部を召喚`;
  },
  // hound と同一の死亡スキル（同ハンドラ・同パラメータ）
  church_hound: (lv) => {
    const b = atLevel(HOUND.token, lv);
    return `死亡: ${b.atk}/${b.hp}頭部を召喚`;
  },
  bat: (lv) => {
    const n = atLevel(BAT.targets, lv);
    const d = atLevel(BAT.damage, lv);
    return `開戦: ランダムな敵${n}体に${d}ダメージ`;
  },
  inquisitor: (lv) => `開戦: 敵前衛に${atLevel(INQUISITOR.damage, lv)}ダメージ`,
  zealot: (lv) => `味方召喚時: 現れた味方の攻撃+${atLevel(ZEALOT.summonBuff, lv)}`,
  squire: (lv) => {
    const b = atLevel(SQUIRE.deathBuff, lv);
    return `死亡: 後ろの味方に+${b.atk}/+${b.hp}`;
  },
  martyr: (lv) => {
    const b = atLevel(MARTYR.deathBuff, lv);
    return `死亡: 後ろ2体に+${b.atk}/+${b.hp}`;
  },
  beast: (lv) => {
    const b = atLevel(BEAST.summon, lv);
    return `死亡: ランダムなTier3素体を${b.atk}/${b.hp}として召喚`;
  },
  church_beast: (lv) => {
    const b = atLevel(CHURCH_BEAST.token, lv);
    return `死亡: ${b.atk}/${b.hp}幼子を召喚`;
  },
  cholera: (lv) =>
    `攻撃前: ランダムな敵1体の装備を【感染】(被ダメージ+3)に変える(${atLevel(CHOLERA.uses, lv)}回/戦)`,
  parasite: (lv) => {
    const b = atLevel(PARASITE.buff, lv);
    return `直前の味方が攻撃: 自身に+${b.atk}/+${b.hp}`;
  },
  revenant: (lv) =>
    `開戦: 前夜敗北なら前方${atLevel(REVENANT.targets, lv)}体の攻撃+${atLevel(REVENANT.buff, lv)}`,
  evangelist: (lv) => `味方死亡: ランダムな敵に${atLevel(EVANGELIST.damage, lv)}ダメージ`,
  altar: (lv) => {
    const b = atLevel(ALTAR.buff, lv);
    return `味方配置/召喚: その味方に+${b.atk}/+${b.hp}`;
  },
  machine: (lv) => {
    const b = atLevel(MACHINE.buff, lv);
    return `出陣時: 最前衛に+${b.atk}/+${b.hp}`;
  },
  shrieking_throat: (lv) => `開戦: 最後尾の敵に${atLevel(BANSHEE.damage, lv)}ダメ`,
  hundred_arms: (lv) =>
    `撃破: 先頭の敵に${atLevel(HUNDRED_ARMS.damageDefault, lv)}ダメ(Tier1に${atLevel(HUNDRED_ARMS.damageT1, lv)}ダメ)`,
  priest: (lv) => {
    const b = atLevel(PRIEST.deathBuff, lv);
    return `死亡: 味方全体に+${b.atk}/+${b.hp}`;
  },
  templar: (lv) => `被弾: 自身に+${atLevel(TEMPLAR.atkBuff, lv)}/+0`,
  beelzebub: (lv) => {
    const b = atLevel(BEELZEBUB.token, lv);
    return `味方死亡: ${b.atk}/${b.hp}の蠅を死亡位置に召喚(最大3回)`;
  },
  eye: (lv) =>
    `直前の味方が攻撃: ランダム敵に${atLevel(EYE.damage, lv)}ダメ(${atLevel(EYE.uses, lv)}回/戦)`,
  rot_ring: (lv) => `Tier1購入: 味方全体に+1/+1(${atLevel(ROT_RING.uses, lv)}回/夜)`,
};

/** テンプレートが登録されているユニットID一覧 */
export const TEMPLATED_UNIT_IDS: ReadonlySet<string> = new Set(Object.keys(TEMPLATES));

export function getSkillText(id: UnitId, level: number, fallback: string): string {
  const tmpl = TEMPLATES[id];
  return tmpl ? tmpl(level) : fallback;
}
