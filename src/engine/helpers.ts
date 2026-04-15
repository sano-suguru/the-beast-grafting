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
  if (night === 1) return [createUnit("squire"), createUnit("church_hound")];
  if (night <= 3)
    return [createUnit("priest"), createUnit("inquisitor"), createUnit("church_hound")];
  if (night <= 6)
    return [
      createUnit("templar"),
      createUnit("priest"),
      createUnit("inquisitor"),
      createUnit("church_beast"),
      createUnit("church_hound"),
    ];
  if (night <= 8)
    return [
      createUnit("paladin"),
      createUnit("flagellant"),
      createUnit("templar"),
      createUnit("priest"),
      createUnit("church_beast"),
    ];
  if (night <= 10)
    return [
      createUnit("cathedral"),
      createUnit("relic_sword"),
      createUnit("paladin"),
      createUnit("flagellant"),
      createUnit("templar"),
    ];
  if (night <= 12)
    return [
      createUnit("holy_fire"),
      createUnit("seraph"),
      createUnit("cathedral"),
      createUnit("relic_sword"),
      createUnit("paladin"),
    ];
  return pickRandom(CULT_TEMPLATES_LATE, rng).map(createUnit);
};

const CULT_TEMPLATES_LATE: ChurchUnitId[][] = [
  ["archangel", "risen_pope", "holy_fire", "seraph", "cathedral"],
  ["archangel", "holy_fire", "seraph", "relic_sword", "paladin"],
  ["risen_pope", "risen_pope", "holy_fire", "cathedral", "seraph"],
  ["cathedral", "seraph", "flagellant", "archangel", "paladin"],
  ["risen_pope", "relic_sword", "flagellant", "holy_fire", "paladin"],
];

const generateGrafterTeam = (night: number, rng: Rng): UnitInstance[] => {
  if (night <= 2) return [createUnit("bat"), createUnit("rat"), createUnit("hound")];
  if (night <= 4)
    return [createUnit("martyr"), createUnit("beast"), createUnit("hound"), createUnit("bat")];
  if (night <= 7)
    return [
      createUnit("parasite"),
      createUnit("maiden"),
      createUnit("beast"),
      createUnit("hound"),
      createUnit("martyr"),
    ];
  if (night <= 10)
    return [
      createUnit("evangelist"),
      createUnit("altar"),
      createUnit("parasite"),
      createUnit("maiden"),
      createUnit("hound"),
    ];
  if (night <= 12)
    return [
      createUnit("shrieking_throat"),
      createUnit("hundred_arms"),
      createUnit("eye"),
      createUnit("parasite"),
      createUnit("maiden"),
    ];
  return pickRandom(GRAFTER_TEMPLATES_LATE, rng).map(createUnit);
};

const GRAFTER_TEMPLATES_LATE: RegularUnitId[][] = [
  ["organ_grinder", "shrieking_throat", "hundred_arms", "eye", "grinning_skull"],
  ["beelzebub", "eye", "hundred_arms", "parasite", "grinning_skull"],
  ["howling_giant", "organ_grinder", "flayed_saint", "eye", "parasite"],
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
