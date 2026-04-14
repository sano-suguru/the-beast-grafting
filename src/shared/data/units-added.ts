import type { RegularUnitId, RawUnitData } from "../types";

/** 追加ユニット定義 (Tier 1-4) */
export const UNITS_ADDED = {
  // Tier 1 追加
  ghoul_infant: {
    id: "ghoul_infant",
    name: "屍食鬼の幼体",
    baseAtk: 1,
    baseHp: 2,
    tier: 1,
    lore: "闇市場の片隅で蠢く小さな人喰い。新しい荷が届くたびに甲高く鳴き、近くの素体が微かに痙攣する。",
  },
  dead_hand: {
    id: "dead_hand",
    name: "齧りつく死手",
    baseAtk: 2,
    baseHp: 1,
    tier: 1,
    lore: "絞首台から落ちた手首。まだ指が動いている。噛みついた先の血を吸い、少しずつ肉が盛り上がっていく。",
  },

  // Tier 2 追加
  devouring_wound: {
    id: "devouring_wound",
    name: "喰らう傷口",
    baseAtk: 3,
    baseHp: 2,
    tier: 2,
    lore: "接合術の失敗で開いた傷口。それ自体が口となり、喰らい、塞がり、また開く。",
  },
  crawling_cord: {
    id: "crawling_cord",
    name: "這い回る臍帯",
    baseAtk: 2,
    baseHp: 3,
    tier: 2,
    lore: "切っても千切れない。死体から死体へ這い移り、何かを運び続けている。",
  },
  tainted_placenta: {
    id: "tainted_placenta",
    name: "汚染する胎盤",
    baseAtk: 2,
    baseHp: 2,
    tier: 2,
    lore: "名もなき上位者の胎盤。触れた死肉を変質させ、本来あり得ない活力を与える。闇市場の商人たちは、この胎盤に触れた素体を「格上」と呼ぶ。",
  },
  graft_scion: {
    id: "graft_scion",
    name: "接ぎ穂の残骸",
    baseAtk: 2,
    baseHp: 3,
    tier: 2,
    lore: "接合術の先駆者が遺した未完成の接ぎ穂。朽ちると筋繊維が前方の宿主に食い込み、すべてを譲り渡す。",
  },

  // Tier 3 追加
  flesh_granulation: {
    id: "flesh_granulation",
    name: "増殖する肉芽",
    baseAtk: 2,
    baseHp: 3,
    tier: 3,
    lore: "新しい肉体が近づくたびに膨れ上がる、異常な肉芽組織。制御不能。だが有用。",
  },
  corroding_mold: {
    id: "corroding_mold",
    name: "侵蝕する黴",
    baseAtk: 2,
    baseHp: 3,
    tier: 3,
    lore: "黴に覆われた死体は、生前より遥かに硬い。",
  },
  omen_womb: {
    id: "omen_womb",
    name: "忌み腹の屍",
    baseAtk: 2,
    baseHp: 4,
    tier: 3,
    lore: "腹に忌みの刻印を持つ死体。裂くと、中から二つの何かが這い出す。",
  },
  corpse_broker: {
    id: "corpse_broker",
    name: "骸の仲買",
    baseAtk: 2,
    baseHp: 3,
    tier: 3,
    lore: "取引のたびに体が大きくなる仲買人。客が持ち込む骨を、自分の体に接ぎ足しているのだ。",
  },

  // Tier 4 追加
  devouring_graft: {
    id: "devouring_graft",
    name: "貪る接合体",
    baseAtk: 3,
    baseHp: 6,
    tier: 4,
    lore: "前にいるものを丸呑みにする。倒されると、腹から飲み込んだ獣が血まみれで這い出してくる。",
  },
  tumor_guardian: {
    id: "tumor_guardian",
    name: "瘤の守り手",
    baseAtk: 2,
    baseHp: 6,
    tier: 4,
    lore: "背中の瘤は傷を受けるたびに脈打ち、背後の死体に何かを注いでいる。",
  },
  groaning_coffin: {
    id: "groaning_coffin",
    name: "唸る棺",
    baseAtk: 2,
    baseHp: 5,
    tier: 4,
    lore: "蓋を開けた者はいない。中から唸り声がする。味方が倒れるたびに、蓋の隙間から何かが漏れ出る。",
  },
  stellar_cocoon: {
    id: "stellar_cocoon",
    name: "星辰の繭",
    baseAtk: 4,
    baseHp: 3,
    tier: 4,
    lore: "星辰の配列が正しい夜にだけ降ってくる、正体不明の繭。破壊されると、中から異形の光を帯びた何かが這い出してくる。闇市の商人は高値を付けるが、手元に長く置きたがる者はいない。",
  },
} as const satisfies Partial<Record<RegularUnitId, RawUnitData>>;
