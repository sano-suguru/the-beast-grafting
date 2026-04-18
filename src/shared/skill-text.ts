import type { ChurchUnitId, RawUnitData, RegularUnitId, UnitData, UnitId } from "./types";
import { invariant } from "./invariant";
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
  MAIDEN,
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
  BUDDING_HYDRA,
  BONE_TREE,
  GRAVE_WORM,
  MARKET_VULTURE,
  ASH_FUNGUS,
  TAINTED_PLACENTA,
  CORRODING_MOLD,
  STELLAR_COCOON,
  DEAD_HAND,
  DEVOURING_WOUND,
  CRAWLING_CORD,
  GHOUL_INFANT,
  NEEDLESHELL_WORM,
  CORPSE_BROKER,
  TUMOR_GUARDIAN,
  GROANING_COFFIN,
  INSATIABLE_MAW,
  WAILING_CURSECHILD,
  AMNIOTIC_ARMOR,
  OMEN_WOMB,
  DEVOURING_GRAFT,
  CHALICE,
} from "./skill-params";

const houndDeathText = (lv: number) => {
  const b = atLevel(HOUND.token, lv);
  return `死亡: ${b.atk}/${b.hp}頭部を召喚`;
};

type SkillTemplate = (lv: number) => string;

const TEMPLATES: Record<RegularUnitId | ChurchUnitId, SkillTemplate> = {
  rat: (lv) => {
    const b = atLevel(RAT.deathBuff, lv);
    return `死亡: ランダム味方1体に+${b.atk}/+${b.hp}`;
  },

  hound: houndDeathText,
  church_hound: houndDeathText,
  bat: (lv) => {
    const n = atLevel(BAT.targets, lv);
    const d = atLevel(BAT.damage, lv);
    return `開戦: ランダムな敵${n}体に${d}ダメージ`;
  },
  church_inquisitor: (lv) => `開戦: 敵前衛に${atLevel(INQUISITOR.damage, lv)}ダメージ`,
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
  revenant: (lv) => {
    const b = atLevel(REVENANT.buff, lv);
    return `前夜敗北時: 前方${atLevel(REVENANT.targets, lv)}体の攻撃+${b}`;
  },
  evangelist: (lv) =>
    `味方死亡: ランダムな敵${atLevel(EVANGELIST.targets, lv)}体を感染させる(${atLevel(EVANGELIST.uses, lv)}回/戦)`,
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
    return `味方死亡: ${b.atk}/${b.hp}の蠅を死亡位置に召喚(${atLevel(BEELZEBUB.uses, lv)}回/戦)`;
  },
  eye: (lv) =>
    `直前の味方が攻撃: ランダム敵に${atLevel(EYE.damage, lv)}ダメ(${atLevel(EYE.uses, lv)}回/戦)`,
  rot_ring: (lv) => {
    const b = atLevel(ROT_RING.buff, lv);
    return `Tier1購入: 味方全体に+${b.atk}/+${b.hp}(${atLevel(ROT_RING.uses, lv)}回/夜)`;
  },
  grave_worm: (lv) => {
    const b = atLevel(GRAVE_WORM.sellBuff, lv);
    return `味方解体: ランダムな味方1体に+${b.atk}/+${b.hp}`;
  },
  leech: (lv) => `被弾: 自身のHP+${atLevel(LEECH.hpBuff, lv)}`,
  crow: (lv) => {
    const b = atLevel(CROW.buff, lv);
    return `味方死亡: 自身に+${b.atk}/+${b.hp}(${atLevel(CROW.uses, lv)}回/戦)`;
  },
  catacomb_rat: (lv) => `開戦: ランダムな敵にTier×${atLevel(CATACOMB_RAT.tierMult, lv)}ダメージ`,
  stitched_twin: (lv) =>
    `被弾: 自身の攻撃+${atLevel(STITCHED_TWIN.atkBuff, lv)}、後方味方に1ダメージ`,
  market_vulture: (lv) => {
    const b = atLevel(MARKET_VULTURE.shopBuff, lv);
    return `味方解体: 闇市場の全素体に+${b.atk}/+${b.hp}`;
  },
  tainted_placenta: (lv) => {
    const b = atLevel(TAINTED_PLACENTA.shopBuff, lv);
    return `ターン開始: 闇市場の素体1体に+${b.atk}/+${b.hp}`;
  },
  flayed_saint: (lv) => `被弾: ランダムな敵に${atLevel(FLAYED_SAINT.damage, lv)}ダメージ`,
  charnel_pit: (lv) => {
    const b = atLevel(CHARNEL_PIT.token, lv);
    return `味方${CHARNEL_PIT.threshold}体死亡ごと: ${b.atk}/${b.hp}を召喚`;
  },
  sin_eater: (lv) =>
    `味方死亡: 死んだ味方の攻撃を吸収(1回上限${atLevel(SIN_EATER.atkCap, lv)}, ${atLevel(SIN_EATER.uses, lv)}回)`,
  blood_font: (lv) => `出陣時: 最もHPが低い味方に+0/+${atLevel(BLOOD_FONT.hpBuff, lv)}`,
  ash_fungus: (lv) =>
    `味方解体/死亡: スタッツの${atLevel(ASH_FUNGUS.percent, lv)}%をランダム味方にバフ`,
  plague_bell: (lv) =>
    `直前の味方が攻撃: 敵全体に${atLevel(PLAGUE_BELL.damage, lv)}ダメージ(${atLevel(PLAGUE_BELL.uses, lv)}回/戦)`,
  hanged_man: (lv) => `死亡: 最終スタッツを前方の味方${atLevel(HANGED_MAN.targets, lv)}体に分配`,
  organ_grinder: (lv) => `撃破: 敵全体に${atLevel(ORGAN_GRINDER.damage, lv)}ダメージ`,
  grinning_skull: (lv) => {
    const b = atLevel(GRINNING_SKULL.buff, lv);
    return `味方${GRINNING_SKULL.threshold}体死亡ごと: 味方全体に+${b.atk}/+${b.hp}(${atLevel(GRINNING_SKULL.uses, lv)}回/戦)`;
  },
  budding_hydra: (lv) => {
    const d = atLevel(BUDDING_HYDRA.divisor, lv);
    const t = atLevel(BUDDING_HYDRA.token, lv);
    return `死亡: HP÷${d}体の${t.atk}/${t.hp}ヒドラの首を召喚`;
  },
  bone_tree: (lv) => {
    const b = atLevel(BONE_TREE.buff, lv);
    const u = atLevel(BONE_TREE.uses, lv);
    return `味方死亡: 前方全体に+${b.atk}/+${b.hp}(${u}回まで)`;
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
  dead_hand: (lv) =>
    `被弾: 自身に+${atLevel(DEAD_HAND.atkBuff, lv)}/+${atLevel(DEAD_HAND.hpBuff, lv)}`,
  devouring_wound: (lv) => `撃破: 自身にHP+${atLevel(DEVOURING_WOUND.hpHeal, lv)}`,
  crawling_cord: (lv) => {
    const b = atLevel(CRAWLING_CORD.buff, lv);
    return `味方死亡: ランダム味方1体に+${b.atk}/+${b.hp}(${atLevel(CRAWLING_CORD.uses, lv)}回/戦)`;
  },
  ghoul_infant: (lv) => `味方購入: 味方1体にATK+${atLevel(GHOUL_INFANT.atkBuff, lv)}`,
  needleshell_worm: (lv) => `攻撃後: 後方味方${atLevel(NEEDLESHELL_WORM.targets, lv)}体に1ダメージ`,
  corpse_broker: (lv) => {
    const b = atLevel(CORPSE_BROKER.sellBuff, lv);
    return `味方解体: 自身に+${b.atk}/+${b.hp}`;
  },
  tumor_guardian: (lv) => {
    const b = atLevel(TUMOR_GUARDIAN.buff, lv);
    return `被弾: 後ろの味方に+${b.atk}/+${b.hp}`;
  },
  groaning_coffin: (lv) =>
    `味方${GROANING_COFFIN.threshold}体死亡ごと: ランダム敵に${atLevel(GROANING_COFFIN.damage, lv)}ダメージ`,
  insatiable_maw: (lv) => {
    const b = atLevel(INSATIABLE_MAW.buff, lv);
    return `味方死亡: 自身に+${b.atk}/+${b.hp}(${atLevel(INSATIABLE_MAW.uses, lv)}回/戦)`;
  },
  wailing_cursechild: (lv) => {
    const b = atLevel(WAILING_CURSECHILD.buff, lv);
    return `味方${WAILING_CURSECHILD.threshold}体死亡ごと: 味方全体に+${b.atk}/+${b.hp}`;
  },
  amniotic_armor: (lv) => `被弾: 自身に【屍蝋】を装備(${atLevel(AMNIOTIC_ARMOR.uses, lv)}回/戦)`,
  omen_womb: (lv) => {
    const t = atLevel(OMEN_WOMB.token, lv);
    return `死亡: 2体の${t.atk}/${t.hp}「忌み子」を召喚`;
  },
  // 固定テキスト（レベルで変化しない）
  beggar: () => "解体: {blood}を1多く獲得",
  maiden: (lv) => `死亡: 後方${atLevel(MAIDEN.targets, lv)}体に【屍蝋の盾】`,
  famine_corpse: () => "直前の味方が攻撃: 敵前衛の攻撃を自身のATK分削る",
  graft_scion: () => "死亡: 前の味方に自身ATK分のATKバフ",
  devouring_graft: (lv) =>
    `開戦: 前の味方を${atLevel(DEVOURING_GRAFT.absorbPercent, lv)}%吸収(+ATK/HP)。死亡: 吸収先の${atLevel(DEVOURING_GRAFT.decayPercent, lv)}%で再召喚`,
  chalice: (lv) => {
    const b = atLevel(CHALICE.buff, lv);
    return `購入: 闇市場の薬を2つの無料【純血】(+${b.atk}/+${b.hp})に`;
  },
  necrotic_finger: () => "常時: 攻撃で対象を即死させる。内蔵: 屍蝋の盾",
  mimicking_flesh: () => "開戦: 前の味方のスキルをコピー(戦闘中のみ)",
  brains: () => "常時: 前の味方の能力2回発動",
  puppeteer: () => "常時: 後ろの味方の死亡能力2回発動",
};

/** テンプレートが登録されているユニットID一覧 */
export const TEMPLATED_UNIT_IDS: ReadonlySet<UnitId> = new Set(Object.keys(TEMPLATES) as UnitId[]);

/** レベルに依存しない固定テキストユニットID一覧（テンプレートの引数arity で自動検出） */
export const FIXED_SKILL_IDS: ReadonlySet<RegularUnitId | ChurchUnitId> = new Set(
  (Object.keys(TEMPLATES) as (RegularUnitId | ChurchUnitId)[]).filter(
    (id) => TEMPLATES[id].length === 0,
  ),
);

export function getSkillText(id: UnitId, level: number): string {
  const tmpl = (TEMPLATES as Partial<Record<UnitId, SkillTemplate>>)[id];
  invariant(tmpl, `no skill template for ${id}`);
  return tmpl(level);
}

export function resolveSkillTexts<K extends RegularUnitId | ChurchUnitId>(
  raw: Record<K, RawUnitData>,
): Record<K, UnitData> {
  const result = {} as Record<K, UnitData>;
  for (const key of Object.keys(raw) as K[]) {
    result[key] = { ...raw[key], skillText: TEMPLATES[key](1) };
  }
  return result;
}
