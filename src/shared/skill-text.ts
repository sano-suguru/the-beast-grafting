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
  CATACOMB_RAT,
  PLAGUE_BELL,
  PALADIN,
  HOLY_FIRE,
  RELIC_SWORD,
  LEECH,
  STITCHED_TWIN,
  FLAYED_SAINT,
  FLAGELLANT,
  HOWLING_GIANT,
  ORGAN_GRINDER,
  RISEN_POPE,
  HANGED_MAN,
  SERAPH,
  CROW,
  SIN_EATER,
  CATHEDRAL,
  CHARNEL_PIT,
  GRINNING_SKULL,
  ARCHANGEL,
  BLOOD_FONT,
  CORPSE_GARDEN,
  BONE_TREE,
  GRAVE_WORM,
  MARKET_VULTURE,
  ASH_FUNGUS,
  TAINTED_PLACENTA,
  CORRODING_MOLD,
  STELLAR_COCOON,
} from "./skill-params";

const houndDeathText = (lv: number) => {
  const b = atLevel(HOUND.token, lv);
  return `死亡: ${b.atk}/${b.hp}頭部を召喚`;
};

const TEMPLATES: Partial<Record<UnitId, (lv: number) => string>> = {
  rat: (lv) => {
    const b = atLevel(RAT.deathBuff, lv);
    return `死亡: 味方1体に+${b.atk}/+${b.hp}`;
  },
  hound: houndDeathText,
  church_hound: houndDeathText,
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
  evangelist: (lv) =>
    `味方死亡: ランダムな敵${atLevel(EVANGELIST.targets, lv)}体を感染させる(自身に${atLevel(EVANGELIST.selfDamage, lv)}ダメ)`,
  altar: (lv) => {
    const b = atLevel(ALTAR.buff, lv);
    return `味方配置/召喚: その味方に+${b.atk}/+${b.hp}`;
  },
  machine: (lv) => {
    const b = atLevel(MACHINE.buff, lv);
    return `直前の味方が攻撃: 最前衛に+${b.atk}/+${b.hp}(${atLevel(MACHINE.uses, lv)}回/戦)`;
  },
  shrieking_throat: (lv) =>
    `開戦: 最後尾の敵に${atLevel(BANSHEE.damage, lv)}ダメ(自身に${atLevel(BANSHEE.selfDamage, lv)}反動)`,
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
  grave_worm: (lv) => {
    const b = atLevel(GRAVE_WORM.sellBuff, lv);
    return `解体: ランダムな味方1体に+${b.atk}/+${b.hp}`;
  },
  leech: (lv) => `被弾: 自身のHP+${atLevel(LEECH.hpBuff, lv)}`,
  crow: (lv) => {
    const b = atLevel(CROW.buff, lv);
    return `味方死亡: 自身に+${b.atk}/+${b.hp}`;
  },
  catacomb_rat: (lv) => `開戦: ランダムな敵にTier×${atLevel(CATACOMB_RAT.tierMult, lv)}ダメージ`,
  stitched_twin: (lv) =>
    `被弾: 自身の攻撃+${atLevel(STITCHED_TWIN.atkBuff, lv)}、後方味方にも同ダメージ`,
  market_vulture: (lv) => {
    const b = atLevel(MARKET_VULTURE.shopBuff, lv);
    return `味方解体: 闇市場の全素体に+${b.atk}/+${b.hp}`;
  },
  tainted_placenta: (lv) => {
    const b = atLevel(TAINTED_PLACENTA.shopBuff, lv);
    return `購入: 闇市場の素体1体に+${b.atk}/+${b.hp}`;
  },
  flayed_saint: (lv) => `被弾: ランダムな敵に${atLevel(FLAYED_SAINT.damage, lv)}ダメージ`,
  charnel_pit: (lv) => {
    const b = atLevel(CHARNEL_PIT.token, lv);
    return `味方${CHARNEL_PIT.threshold}体死亡ごと: ${b.atk}/${b.hp}を召喚`;
  },
  sin_eater: (lv) =>
    `味方死亡: 死んだ味方の攻撃を吸収(1回上限${atLevel(SIN_EATER.atkCap, lv)}, ${atLevel(SIN_EATER.uses, lv)}回)`,
  blood_font: (lv) => `出陣時: 最もHPが低い味方に+0/+${atLevel(BLOOD_FONT.hpBuff, lv)}`,
  ash_fungus: (lv) => `味方解体: スタッツの${atLevel(ASH_FUNGUS.percent, lv)}%をランダム味方にバフ`,
  plague_bell: (lv) =>
    `直前の味方が攻撃: 敵全体に${atLevel(PLAGUE_BELL.damage, lv)}ダメージ(${atLevel(PLAGUE_BELL.uses, lv)}回/戦)`,
  hanged_man: (lv) => `死亡: 最終スタッツを前方の味方${atLevel(HANGED_MAN.targets, lv)}体に分配`,
  organ_grinder: (lv) => `撃破: 敵全体に${atLevel(ORGAN_GRINDER.damage, lv)}ダメージ`,
  grinning_skull: (lv) => {
    const b = atLevel(GRINNING_SKULL.buff, lv);
    return `味方${GRINNING_SKULL.threshold}体死亡ごと: 味方全体に+${b.atk}/+${b.hp}`;
  },
  corpse_garden: (lv) => {
    const b = atLevel(CORPSE_GARDEN.buff, lv);
    return `出陣時: 空きに+${b.atk}/+${b.hp}のTier1を召喚`;
  },
  bone_tree: (lv) => {
    const b = atLevel(BONE_TREE.buff, lv);
    return `購入: Tier数×味方全体に+${b.atk}/+${b.hp}`;
  },
  howling_giant: (lv) => `被弾: 味方全体の攻撃+${atLevel(HOWLING_GIANT.atkBuff, lv)}`,
  paladin: (lv) => `開戦: 味方全体のHP+${atLevel(PALADIN.hpBuff, lv)}`,
  flagellant: (lv) => {
    const b = atLevel(FLAGELLANT.buff, lv);
    return `被弾: 後方味方に+${b.atk}/+${b.hp}`;
  },
  cathedral: (lv) => {
    const b = atLevel(CATHEDRAL.token, lv);
    return `味方死亡: ${b.atk}/${b.hp}信徒を召喚(最大${atLevel(CATHEDRAL.uses, lv)}回/戦)`;
  },
  relic_sword: (lv) => `直前の味方が攻撃: 前衛の攻撃+${atLevel(RELIC_SWORD.atkBuff, lv)}`,
  seraph: (lv) => {
    const b = atLevel(SERAPH.deathBuff, lv);
    return `死亡: 味方全体に+${b.atk}/+${b.hp}`;
  },
  holy_fire: (lv) => `開戦: 最もHPの高い敵に${atLevel(HOLY_FIRE.damage, lv)}ダメージ`,
  archangel: (lv) => {
    const b = atLevel(ARCHANGEL.buff, lv);
    return `味方${ARCHANGEL.threshold}体死亡ごと: 自身に+${b.atk}/+${b.hp}`;
  },
  corroding_mold: (lv) => {
    const b = atLevel(CORRODING_MOLD.buff, lv);
    return `開戦: 前の味方に+${b.atk}/+${b.hp}`;
  },
  stellar_cocoon: (lv) => {
    const b = atLevel(STELLAR_COCOON.summon, lv);
    return `死亡: ${b.atk}/${b.hp}の星の落とし子を召喚(倒した敵を錯乱させる)`;
  },
  risen_pope: (lv) => {
    const b = atLevel(RISEN_POPE.buff, lv);
    return `撃破: 味方全体に+${b.atk}/+${b.hp}`;
  },
};

/** テンプレートが登録されているユニットID一覧 */
export const TEMPLATED_UNIT_IDS: ReadonlySet<UnitId> = new Set(Object.keys(TEMPLATES) as UnitId[]);

export function getSkillText(id: UnitId, level: number, fallback: string): string {
  const tmpl = TEMPLATES[id];
  return tmpl ? tmpl(level) : fallback;
}
