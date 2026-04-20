import { UNITS } from "../shared/data/units";
import { lookupUnitData, isChurchUnit } from "../shared/data/unit-lookup";
import type {
  UnitInstance,
  EnemyTeam,
  EnemyFaction,
  DataUnitId,
  RegularUnitId,
  ChurchUnitId,
  ItemId,
  Tier,
} from "../shared/types";
import type { Rng } from "./rng";
import { invariant } from "../shared/invariant";
import { TIERS, getCurrentMaxTier } from "../shared/data/tiers";
import { getSkillText } from "../shared/skill-text";

export const generateUid = (): string => Math.random().toString(36).substring(2, 11);

export const createUnit = (id: DataUnitId): UnitInstance => {
  const data = lookupUnitData(id);
  invariant(data, `unknown unit id: ${id}`);
  const isChurch = isChurchUnit(id);
  return {
    ...data,
    buffAtk: 0,
    buffHp: 0,
    tempBuffAtk: 0,
    level: 1,
    exp: 0,
    equip: null,
    uid: generateUid(),
    isChurch,
    skillText: getSkillText(id, 1),
  };
};

const SHOP_POOL_CACHE = new Map<number, readonly RegularUnitId[]>();

export const getShopPool = (night: number): readonly RegularUnitId[] => {
  const cached = SHOP_POOL_CACHE.get(night);
  if (cached) return cached;
  const maxTier = getCurrentMaxTier(night);
  const pool = TIERS.filter((t) => t <= maxTier).flatMap((t) => getUnitsByTier(t));
  SHOP_POOL_CACHE.set(night, pool);
  return pool;
};

const UNITS_BY_TIER = new Map<Tier, RegularUnitId[]>();
for (const id of Object.keys(UNITS) as RegularUnitId[]) {
  const tier = UNITS[id].tier;
  const list = UNITS_BY_TIER.get(tier);
  if (list) list.push(id);
  else UNITS_BY_TIER.set(tier, [id]);
}

export const getUnitsByTier = (tier: Tier): readonly RegularUnitId[] =>
  UNITS_BY_TIER.get(tier) ?? [];

export const getItemPool = (): ItemId[] => [
  "preservative",
  "iron_plate",
  "bile",
  "maggot",
  "corpse_wax",
  "numbness",
  "acid_blood",
  "death_curse",
];

export const pickRandom = <T>(arr: readonly T[], rng: Rng): T => {
  invariant(arr.length > 0, "pickRandom: empty array");
  return arr[Math.floor(rng.next() * arr.length)]!;
};

const generateTeamName = (faction: EnemyFaction, rng: Rng): string => {
  const adjectivesCult = ["純白の", "灰の", "盲目なる", "断罪の"];
  const nounsCult = ["巡礼者部隊", "異端審問隊", "聖騎士団"];
  const adjectivesGrafter = ["貪欲なる", "狂気に飲まれた", "血塗られた", "名もなき"];
  const nounsGrafter = ["地下の接合術師", "解剖医", "死体泥棒"];

  const isCult = faction === "教団";
  const adj = isCult ? pickRandom(adjectivesCult, rng) : pickRandom(adjectivesGrafter, rng);
  const noun = isCult ? pickRandom(nounsCult, rng) : pickRandom(nounsGrafter, rng);
  return `[${faction}] ${adj}${noun}`;
};

const generateCultTeam = (night: number, rng: Rng): UnitInstance[] => {
  if (night === 1) return [createUnit("church_hound"), createUnit("squire")];
  if (night <= 3)
    return [createUnit("church_hound"), createUnit("church_inquisitor"), createUnit("priest")];
  if (night <= 6)
    return [
      createUnit("church_hound"),
      createUnit("church_beast"),
      createUnit("church_inquisitor"),
      createUnit("priest"),
      createUnit("templar"),
    ];
  if (night <= 8)
    return [
      createUnit("church_beast"),
      createUnit("priest"),
      createUnit("templar"),
      createUnit("flagellant"),
      createUnit("paladin"),
    ];
  if (night <= 10)
    return [
      createUnit("templar"),
      createUnit("flagellant"),
      createUnit("paladin"),
      createUnit("relic_sword"),
      createUnit("cathedral"),
    ];
  if (night <= 12)
    return [
      createUnit("paladin"),
      createUnit("relic_sword"),
      createUnit("cathedral"),
      createUnit("seraph"),
      createUnit("holy_fire"),
    ];
  return pickRandom(CULT_TEMPLATES_LATE, rng).map(createUnit);
};

// 各配列は index 0 = 前衛, index N-1 = 後衛 の規約で定義する
const CULT_TEMPLATES_LATE: ChurchUnitId[][] = [
  ["cathedral", "seraph", "holy_fire", "risen_pope", "archangel"],
  ["paladin", "relic_sword", "seraph", "holy_fire", "archangel"],
  ["seraph", "cathedral", "holy_fire", "risen_pope", "risen_pope"],
  ["paladin", "archangel", "flagellant", "seraph", "cathedral"],
  ["paladin", "holy_fire", "flagellant", "relic_sword", "risen_pope"],
];

const generateGrafterTeam = (night: number, rng: Rng): UnitInstance[] => {
  if (night <= 2) return [createUnit("hound"), createUnit("rat"), createUnit("bat")];
  if (night <= 4)
    return [createUnit("bat"), createUnit("hound"), createUnit("beast"), createUnit("martyr")];
  if (night <= 7)
    return [
      createUnit("martyr"),
      createUnit("hound"),
      createUnit("beast"),
      createUnit("maiden"),
      createUnit("parasite"),
    ];
  if (night <= 10)
    return [
      createUnit("hound"),
      createUnit("maiden"),
      createUnit("parasite"),
      createUnit("altar"),
      createUnit("evangelist"),
    ];
  if (night <= 12)
    return [
      createUnit("maiden"),
      createUnit("parasite"),
      createUnit("eye"),
      createUnit("hundred_arms"),
      createUnit("shrieking_throat"),
    ];
  return pickRandom(GRAFTER_TEMPLATES_LATE, rng).map(createUnit);
};

const GRAFTER_TEMPLATES_LATE: RegularUnitId[][] = [
  ["grinning_skull", "eye", "hundred_arms", "shrieking_throat", "organ_grinder"],
  ["grinning_skull", "parasite", "hundred_arms", "eye", "beelzebub"],
  ["parasite", "eye", "flayed_saint", "organ_grinder", "howling_giant"],
];

export const generateEnemyTeam = (night: number, rng: Rng): EnemyTeam => {
  const isCult = rng.next() > night * 0.1;
  const type = isCult ? "教団" : "同業者";
  const teamName = generateTeamName(type, rng);

  let units = isCult ? generateCultTeam(night, rng) : generateGrafterTeam(night, rng);

  // Make end-game enemies stronger randomly
  if (night >= 5) {
    const bonus = Math.floor(night / 2);
    units = units.map((u) => ({
      ...u,
      baseAtk: u.baseAtk + bonus,
      baseHp: u.baseHp + bonus,
      level: Math.min(3, Math.ceil(night / 4)),
    }));
  }

  return { teamName, teamType: type, units, night: null, life: null, trophy: null };
};

export { getEquipInfo } from "../shared/data/equips";
