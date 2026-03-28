import { UNITS } from "../data/units";
import { CHURCH_UNITS } from "../data/church-units";
import { EQUIPS } from "../data/equips";
import type {
  UnitInstance,
  EnemyTeam,
  EnemyFaction,
  EquipType,
  RegularUnitId,
  ChurchUnitId,
  ItemId,
} from "../types";
import type { Rng } from "./rng";
import { createDefaultRng } from "./rng";
import { invariant } from "../../shared/invariant";

export const generateUid = (): string => Math.random().toString(36).substring(2, 11);

export const createUnit = (id: RegularUnitId | ChurchUnitId): UnitInstance => {
  const isChurch = Object.hasOwn(CHURCH_UNITS, id);
  const data = isChurch ? CHURCH_UNITS[id as ChurchUnitId] : UNITS[id as RegularUnitId];
  return {
    ...data,
    atk: data.baseAtk,
    hp: data.baseHp,
    level: 1,
    exp: 0,
    equip: null,
    uid: generateUid(),
    isChurch,
  };
};

export function getCurrentMaxTier(round: number): number {
  if (round >= 11) return 6;
  if (round >= 9) return 5;
  if (round >= 7) return 4;
  if (round >= 5) return 3;
  if (round >= 3) return 2;
  return 1;
}

export const getShopPool = (round: number): RegularUnitId[] => {
  const maxTier = getCurrentMaxTier(round);
  const pool: RegularUnitId[] = [];
  for (let t = 1; t <= maxTier; t++) {
    pool.push(...getUnitsByTier(t));
  }
  return pool;
};

const UNITS_BY_TIER = new Map<number, RegularUnitId[]>();
for (const id of Object.keys(UNITS) as RegularUnitId[]) {
  const tier = UNITS[id].tier;
  const list = UNITS_BY_TIER.get(tier);
  if (list) list.push(id);
  else UNITS_BY_TIER.set(tier, [id]);
}

export const getUnitsByTier = (tier: number): readonly RegularUnitId[] =>
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

export const pickRandom = <T>(arr: T[], rng: Rng): T => {
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

const generateCultTeam = (round: number): UnitInstance[] => {
  if (round === 1) return [createUnit("squire"), createUnit("church_hound")];
  if (round <= 3)
    return [createUnit("priest"), createUnit("inquisitor"), createUnit("church_hound")];
  if (round <= 6)
    return [
      createUnit("templar"),
      createUnit("priest"),
      createUnit("inquisitor"),
      createUnit("church_beast"),
      createUnit("church_hound"),
    ];
  return [
    createUnit("templar"),
    createUnit("templar"),
    createUnit("priest"),
    createUnit("church_beast"),
    createUnit("church_beast"),
  ];
};

const generateGrafterTeam = (round: number): UnitInstance[] => {
  if (round <= 2) return [createUnit("bat"), createUnit("rat"), createUnit("hound")];
  if (round <= 4)
    return [createUnit("martyr"), createUnit("beast"), createUnit("hound"), createUnit("bat")];
  if (round <= 7)
    return [
      createUnit("parasite"),
      createUnit("maiden"),
      createUnit("beast"),
      createUnit("hound"),
      createUnit("martyr"),
    ];
  if (round <= 10)
    return [
      createUnit("evangelist"),
      createUnit("altar"),
      createUnit("parasite"),
      createUnit("maiden"),
      createUnit("hound"),
    ];
  return [
    createUnit("shrieking_throat"),
    createUnit("hundred_arms"),
    createUnit("eye"),
    createUnit("parasite"),
    createUnit("maiden"),
  ];
};

export const generateEnemyTeam = (round: number, rng: Rng = createDefaultRng()): EnemyTeam => {
  const isCult = rng.next() > round * 0.1;
  const type = isCult ? "教団" : "同業者";
  const teamName = generateTeamName(type, rng);

  let units = isCult ? generateCultTeam(round) : generateGrafterTeam(round);

  // Make end-game enemies stronger randomly
  if (round >= 5) {
    units = units.map((u) => ({
      ...u,
      atk: u.atk + Math.floor(round / 2),
      hp: u.hp + Math.floor(round / 2),
      level: Math.min(3, Math.ceil(round / 4)),
    }));
  }

  return { teamName, teamType: type, units };
};

export const getEquipInfo = (equipId: EquipType) => EQUIPS[equipId];
