import type { ChurchUnitId, RawUnitData, RegularUnitId, UnitData, UnitId } from "./types";
import { invariant } from "./invariant";
import { ITEMS } from "./data/items";
import {
  atLevel,
  BAT,
  INQUISITOR,
  BANSHEE,
  REVENANT,
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
  PLAGUE_BELL,
  PALADIN,
  HOLY_FIRE,
  RELIC_SWORD,
  STITCHED_TWIN,
  FLAYED_SAINT,
  FLAGELLANT,
  HOWLING_GIANT,
  ORGAN_GRINDER,
  RISEN_POPE,
  HANGED_MAN,
  SERAPH,
  SIN_EATER,
  CATHEDRAL,
  SPITE_BEAST,
  GRINNING_SKULL,
  ARCHANGEL,
  CARRION_SENTINEL,
  GORILLA,
  MAMMOTH,
  CAT,
  ASH_FUNGUS,
  TAINTED_PLACENTA,
  CORRODING_MOLD,
  STELLAR_COCOON,
  CRAWLING_CORD,
  NEEDLESHELL_WORM,
  CORPSE_BROKER,
  TUMOR_GUARDIAN,
  GROANING_COFFIN,
  INSATIABLE_MAW,
  WAILING_CURSECHILD,
  AMNIOTIC_ARMOR,
  OMEN_WOMB,
  CHALICE,
  GUT_HAND,
  BONE_JAW,
  ROT_FEEDER,
  CORPSE_PECKER,
  NESTING_GRUB,
  CHOLERA,
  DEVOURING_WOUND,
  CATACOMB_RAT,
  GRAFT_SCION,
  MARKET_VULTURE,
  FAMINE_CORPSE,
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
  zealot: (lv) => `味方召喚時: 現れた味方の攻撃+${atLevel(ZEALOT.summonBuff, lv)}(次のターンまで)`,
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
  cholera: (lv) => `死亡: 全体に${atLevel(CHOLERA.damage, lv)}ダメージ`,
  parasite: (lv) => {
    const b = atLevel(PARASITE.buff, lv);
    return `味方召喚: 自身に+${b.atk}/+${b.hp}(戦闘終了まで)`;
  },
  revenant: (lv) =>
    `ターン開始: 前方${atLevel(REVENANT.targets, lv)}体に+${REVENANT.buff.atk}/+${REVENANT.buff.hp}`,
  evangelist: (lv) => `開戦: 最高HPの敵のHPを${atLevel(EVANGELIST.reductionPercent, lv)}%削減`,
  altar: (lv) => {
    const b = atLevel(ALTAR.buff, lv);
    return `ターン終了: Lv${ALTAR.requiredFriendLevel}の味方がいれば自身に+${b.atk}/+${b.hp}`;
  },
  machine: (lv) => `ターン開始: 闇市場の全錬金薬を${atLevel(MACHINE.discount, lv)}血値引き`,
  shrieking_throat: (lv) =>
    `開戦: 最後尾の敵に${BANSHEE.damage}ダメージを${atLevel(BANSHEE.uses, lv)}回`,
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
    `攻撃前: ランダムな敵1体に${atLevel(EYE.damage, lv)}ダメ(${atLevel(EYE.uses, lv)}回/戦)`,
  rot_ring: (lv) => {
    const b = atLevel(ROT_RING.buff, lv);
    return `Tier1購入: 味方全体に+${b.atk}/+${b.hp}(${atLevel(ROT_RING.uses, lv)}回/夜)`;
  },
  catacomb_rat: (lv) =>
    `ターン終了: 前回敗北なら前方${CATACOMB_RAT.targets}体の攻撃+${atLevel(CATACOMB_RAT.atkBuff, lv)}`,
  stitched_twin: (lv) => `被弾: 自身の攻撃+${atLevel(STITCHED_TWIN.atkBuff, lv)}`,
  market_vulture: (lv) =>
    `開戦: 最もHPの高い味方のHP×${atLevel(MARKET_VULTURE.percent, lv)}%を自身に獲得`,
  tainted_placenta: (lv) => `ターン開始: {blood}+${atLevel(TAINTED_PLACENTA.bloodGain, lv)}`,
  flayed_saint: (lv) => {
    const b = atLevel(FLAYED_SAINT.buff, lv);
    return `被弾: 後方味方に+${b.atk}/+${b.hp}`;
  },
  spite_beast: (lv) => `死亡: 攻撃の${atLevel(SPITE_BEAST.percent, lv)}%ダメージを隣接ユニットに`,
  sin_eater: (lv) => {
    const b = atLevel(SIN_EATER.buff, lv);
    return `撃破: 自身に+${b.atk}/+${b.hp}(${SIN_EATER.maxUses}回/戦)`;
  },
  carrion_sentinel: (lv) =>
    `前の味方が死亡: 【屍蝋の盾】と攻撃+1を得る(${atLevel(CARRION_SENTINEL.uses, lv)}回/戦)`,
  ash_fungus: (lv) =>
    `ターン開始: Lv${ASH_FUNGUS.minLevel}以上の味方${ASH_FUNGUS.targets}体に+${atLevel(ASH_FUNGUS.buff, lv)}/+${atLevel(ASH_FUNGUS.buff, lv)}`,
  plague_bell: (lv) => {
    const b = atLevel(PLAGUE_BELL.buff, lv);
    return `自身が薬投与時: 他のランダム${PLAGUE_BELL.targets}体に+${b.atk}/+${b.hp}`;
  },
  hanged_man: (lv) => {
    const b = atLevel(HANGED_MAN.buff, lv);
    return `ターン終了: 最前の味方に+${b.atk}/+${b.hp}`;
  },
  organ_grinder: (lv) => {
    const t = atLevel(ORGAN_GRINDER.targets, lv);
    const p = ORGAN_GRINDER.percent;
    return `開戦: ランダムな敵${t}体に自身の攻撃${p}%ダメージ`;
  },
  grinning_skull: (lv) =>
    `味方${GRINNING_SKULL.threshold}体被弾ごと: 敵全体のHPを${atLevel(GRINNING_SKULL.hpReduction, lv)}削る(最低1)`,
  budding_hydra: (lv) => {
    const b = atLevel(MAMMOTH.buff, lv);
    return `死亡: 味方全体に+${b.atk}/+${b.hp}`;
  },
  bone_tree: (lv) => {
    const u = atLevel(CAT.uses, lv);
    const m = atLevel(CAT.multPerCat, lv);
    return `常時: アイテム装備のATK/HP増加×${1 + m}(${u}回/ターン)`;
  },
  howling_giant: (lv) => {
    const b = atLevel(HOWLING_GIANT.buff, lv);
    return `攻撃前: 自身に+${b.atk}/+${b.hp}(戦闘のみ)`;
  },
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
  corroding_mold: (lv) =>
    `開戦: 自身の攻撃の${atLevel(CORRODING_MOLD.percent, lv)}%を前の味方に付与`,
  stellar_cocoon: (lv) =>
    `死亡: ATK×50%(HP1)の落とし子を${atLevel(STELLAR_COCOON.count, lv)}体召喚`,
  risen_pope: (lv) => {
    const b = atLevel(RISEN_POPE.buff, lv);
    return `撃破: 味方全体に+${b.atk}/+${b.hp}`;
  },
  devouring_wound: (lv) => `死亡: 敵側に1/1を${atLevel(DEVOURING_WOUND.uses, lv)}体召喚`,
  crawling_cord: (lv) => {
    const b = atLevel(CRAWLING_CORD.buff, lv);
    return `直前の味方が攻撃: 自身に+${b.atk}/+${b.hp}`;
  },
  needleshell_worm: (lv) =>
    `攻撃後: 後方の味方に1ダメージ×${atLevel(NEEDLESHELL_WORM.targets, lv)}回`,
  corpse_broker: (lv) =>
    `味方への投与: その味方にHP+${atLevel(CORPSE_BROKER.hpBuff, lv)}(${CORPSE_BROKER.maxUses}回/ターン)`,
  tumor_guardian: (lv) => `被弾: ランダムな敵に${atLevel(TUMOR_GUARDIAN.damage, lv)}ダメージ`,
  groaning_coffin: (lv) => {
    const t = atLevel(GROANING_COFFIN.token, lv);
    return `死亡: ${t.atk}/${t.hp}の【酸の血液】付きトークンを召喚`;
  },
  insatiable_maw: (lv) => {
    const b = atLevel(INSATIABLE_MAW.buff, lv);
    return `味方死亡: 自身に+${b.atk}/+${b.hp}`;
  },
  wailing_cursechild: (lv) => {
    const b = atLevel(WAILING_CURSECHILD.buff, lv);
    return `味方召喚時: その味方に+${b.atk}/+${b.hp}`;
  },
  amniotic_armor: (lv) => `開戦: 敵味方全体のHPに+${atLevel(AMNIOTIC_ARMOR.hpBuff, lv)}`,
  omen_womb: (lv) => {
    const t = atLevel(OMEN_WOMB.token, lv);
    return `死亡: 2体の${t.atk}/${t.hp}「忌み子」を召喚`;
  },
  // 固定テキスト（レベルで変化しない）
  beggar: () => "解体: {blood}を多く獲得",
  gut_hand: (lv) => `購入: ランダムな味方${atLevel(GUT_HAND.targets, lv)}体にHP+${GUT_HAND.hpBuff}`,
  bone_jaw: (lv) => `解体: 味方${BONE_JAW.targets}体に攻撃+${atLevel(BONE_JAW.atkBuff, lv)}`,
  rot_feeder: (lv) => `解体: 闇市場の全素体にHP+${atLevel(ROT_FEEDER.hpBuff, lv)}`,
  corpse_pecker: (lv) =>
    `解体: 無料の骨粉(+1/+0)を${atLevel(CORPSE_PECKER.breadCrumbs, lv)}個ストック`,
  nesting_grub: (lv) => {
    const b = atLevel(NESTING_GRUB.buff, lv);
    return b.atk === 0 && b.hp === 0
      ? "接合で強化: (効果なし)"
      : `接合で強化: 味方${NESTING_GRUB.targets}体に+${b.atk}/+${b.hp}`;
  },
  maiden: (lv) => `死亡: 後方${atLevel(MAIDEN.targets, lv)}体に【屍蝋の盾】`,
  famine_corpse: (lv) =>
    `開戦: 最もHPの低い敵に${FAMINE_CORPSE.damage}ダメージ(${atLevel(FAMINE_CORPSE.uses, lv)}回)`,
  graft_scion: (lv) => {
    const item = ITEMS[atLevel(GRAFT_SCION.itemId, lv)];
    return `ターン開始: ${item.cost}血の${item.name}(+${item.atk}/+${item.hp})を闇市場に補充`;
  },
  devouring_graft: () => "開戦: 前の味方を飲み込む。死亡: 飲み込んだ味方を再召喚",
  chalice: (lv) => {
    const b = atLevel(CHALICE.buff, lv);
    return `購入: 闇市場の薬を2つの無料【純血】(+${b.atk}/+${b.hp})に`;
  },
  necrotic_finger: () => "常時: 攻撃で対象を即死させる。内蔵: 屍蝋の盾",
  mimicking_flesh: () => "開戦: 前の味方のスキルをコピー(戦闘中のみ)",
  brains: (lv) => `常時: 前の味方の能力×${1 + lv}`,
  puppeteer: (lv) => `被弾: 【屍蝋の盾】を得る(${atLevel(GORILLA.uses, lv)}回/戦)`,
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
