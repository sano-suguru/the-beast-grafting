import type { RegularUnitId, RawUnitData } from "../types";

/** Tier 1-2 ユニット定義 */
export const UNITS_TIER12 = {
  // Tier 1
  rat: {
    id: "rat",
    name: "疫病ネズミ",
    baseAtk: 2,
    baseHp: 2,
    tier: 1,
    lore: "路地裏で掃いて捨てるほど見つかる。価値はないが、腹に溜め込んだ病原菌は他の素体を刺激する。",
    secretLore:
      "外へ放たれた巨大なネズミは、一夜にして貧民街を壊滅させた。彼らが通った後には、骨すら残らなかったという。",
  },
  beggar: {
    id: "beggar",
    name: "浮浪者の遺体",
    baseAtk: 4,
    baseHp: 1,
    tier: 1,
    lore: "教会の施しを受けられず餓死した名もなき者。胃袋を裂けば飲み込んで隠した硬貨が出てくるかもしれない。",
    secretLore:
      "その胃袋から無限に溢れ出る硬貨は、数多の強欲な商人たちを狂わせ、街を凄惨な殺し合いへと発展させた。",
  },
  hound: {
    id: "hound",
    name: "猟犬の骸",
    baseAtk: 1,
    baseHp: 3,
    tier: 1,
    lore: "主人の亡骸を守り、騎士たちに最後まで牙を剥いた忠犬。首を落とされてなお、顎の力は衰えていない。",
    secretLore:
      "主人の腕を繋がれた犬は、街中の教団騎士の喉を的確に噛みちぎり、静かに主人の墓前で永遠の眠りについた。",
  },
  bat: {
    id: "bat",
    name: "串刺しの蝙蝠",
    baseAtk: 2,
    baseHp: 2,
    tier: 1,
    lore: "異端審問官の放った銀の矢に貫かれた夜の獣。まだ微かに皮膜を動かし、生き血を求めている。",
    secretLore:
      "太陽の光すら克服したその恐るべき吸血鬼は、大聖堂の鐘楼に巣食い、毎夜神父たちの血を啜り続けている。",
  },
  zealot: {
    id: "zealot",
    name: "狂信者の生首",
    baseAtk: 2,
    baseHp: 1,
    tier: 1,
    lore: "異端としてギロチンにかけられた男の頭部。口を太い糸で縫い合わせても、未だに悍ましい呪詛を唱え続けている。",
    secretLore: "その口が唱え続けた冒涜の言葉は、ついに空を割り、街に血の雨を降らせた。",
  },
  gut_hand: {
    id: "gut_hand",
    name: "腑分け師の手",
    baseAtk: 1,
    baseHp: 4,
    tier: 1,
    lore: "闇市場に雇われた腑分け師の切り落とされた右手。新しい素体が届くと、指が独りでに動き出し、周囲の肉を縫い合わせ始める。",
    secretLore:
      "その手が縫い合わせた素体は不思議と血色が良く、やがて術師たちは手の持ち主を探すのをやめ、手だけを重用するようになった。",
  },
  bone_jaw: {
    id: "bone_jaw",
    name: "骨齧りの顎",
    baseAtk: 3,
    baseHp: 2,
    tier: 1,
    lore: "解体場の隅に転がる、何者かの顎骨。素体が解体されるたび、骨を齧り砕く音が響き、近くの素体の牙が鋭くなる。",
    secretLore:
      "顎が齧り尽くした骨の山は、いつしか解体場の壁より高くなり、その下から新たな顎が生えてきた。",
  },
  rot_feeder: {
    id: "rot_feeder",
    name: "腐肉撒き",
    baseAtk: 2,
    baseHp: 2,
    tier: 1,
    lore: "市場の排水溝に棲む扁平な蟲。解体のたびに腐肉の欠片を引きずり出し、売り物の素体に擦りつける。",
    secretLore:
      "蟲が撒いた肉片に触れた素体は、一晩で元の二倍の重量になった。中身が何に置き換わったのかは、誰も知らない。",
  },
  corpse_pecker: {
    id: "corpse_pecker",
    name: "死肉啄み",
    baseAtk: 3,
    baseHp: 2,
    tier: 1,
    lore: "絞首台に棲みつく嘴の長い蟲。解体された死体を啄み、骨を粉にして巣穴に溜め込む。",
    secretLore:
      "巣穴から掘り出された骨粉を素体に振りかけると、筋繊維が異常な速度で再生した。術師たちはこの蟲を『粉挽き』と呼ぶ。",
  },
  nesting_grub: {
    id: "nesting_grub",
    name: "寄生蟲",
    baseAtk: 2,
    baseHp: 3,
    tier: 1,
    lore: "素体の臓腑に巣食う透明な蟲。宿主が成長すると、体内から仔蟲を射出して周囲の素体に寄生させる。",
    secretLore:
      "最終宿主の腹を裂いた術師は、臓腑のすべてが蟲に置き換わっていることに気づいた。だがその素体は、誰よりも強かった。",
  },

  // Tier 2
  martyr: {
    id: "martyr",
    name: "苦悶する殉教者",
    baseAtk: 3,
    baseHp: 2,
    tier: 2,
    lore: "火炙りにされた異端者の黒焦げの遺体。その喉は焼かれながらも、同胞を鼓舞する呪詛を叫び続けている。",
    secretLore:
      "その果てなき呪詛は本物の奇跡を呼び起こし、中央処刑場跡には今も決して消えることのない業火が燃え盛っている。",
  },
  beast: {
    id: "beast",
    name: "孕みし腐肉獣",
    baseAtk: 2,
    baseHp: 3,
    tier: 2,
    lore: "腹部が異様に膨れ上がった正体不明の獣の死骸。中で何かが胎動しており、今にも腹を食い破って出てきそうだ。",
    secretLore:
      "腹から這い出た『子』たちはネズミ算式に増殖し、王都の広大な地下水路は彼らの巨大で醜悪な苗床と化した。",
  },
  cholera: {
    id: "cholera",
    name: "コレラ患者の遺体",
    baseAtk: 4,
    baseHp: 2,
    tier: 2,
    lore: "隔離病棟から盗み出された遺体。その体液は触れる者すべてを死に至らしめる。",
    secretLore: "その致死の病はついに貴族街へと到達し、豪奢な館はすべて静寂な霊廟へと変わった。",
  },
  catacomb_rat: {
    id: "catacomb_rat",
    name: "聖骨齧り",
    baseAtk: 2,
    baseHp: 3,
    tier: 2,
    lore: "地下墓地の聖人の骨を齧って育った鼠。位の高い骨ほど、旨いらしい。",
    secretLore: "大聖堂の礎石が崩れた朝、基礎に無数の歯形があった。",
  },
  stitched_twin: {
    id: "stitched_twin",
    name: "継ぎ接ぎの肉",
    baseAtk: 2,
    baseHp: 4,
    tier: 2,
    lore: "背中合わせに縫い付けた二匹の獣。片方を殴ると、もう片方が手当たり次第に噛みつく。",
    secretLore: "二匹の叫びが重なった瞬間、十歩以内の鼓膜がすべて裂けた。",
  },
  market_vulture: {
    id: "market_vulture",
    name: "闇市の禿鷹",
    baseAtk: 2,
    baseHp: 3,
    tier: 2,
    lore: "市場の梁に止まる太った禿鷹。こいつがいる日は、なぜか素体の血色がいい。",
    secretLore: "禿鷹が飛び立った日、市場に並ぶ肉がすべて腐った。",
  },
  devouring_wound: {
    id: "devouring_wound",
    name: "喰らう傷口",
    baseAtk: 3,
    baseHp: 3,
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
} as const satisfies Partial<Record<RegularUnitId, RawUnitData>>;
