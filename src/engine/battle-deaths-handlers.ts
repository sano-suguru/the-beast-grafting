import type { UnitId } from "../shared/types";
import type { DeathHandler } from "./battle-deaths-handlers-unit";
import {
  handleRatDeath,
  handleHoundDeath,
  handleBeastDeath,
  handleChurchBeastDeath,
  handleSquireDeath,
  handlePriestDeath,
  handleMaidenDeath,
  handleMartyrDeath,
  handleSeraphDeath,
} from "./battle-deaths-handlers-unit";
import {
  handleOmenWombDeath,
  handleStellarCocoonDeath,
  handleDevouringGraftDeath,
  handleGroaningCoffinDeath,
  handleBuddingHydraDeath,
  handleDevouringWoundDeath,
} from "./battle-deaths-handlers-spawn";
import { handleCholeraDeath, handleSpiteBeastDeath } from "./battle-deaths-handlers-aoe";

export const UNIT_DEATH_HANDLERS = {
  rat: handleRatDeath,
  hound: handleHoundDeath,
  church_hound: handleHoundDeath,
  beast: handleBeastDeath,
  martyr: handleMartyrDeath,
  church_beast: handleChurchBeastDeath,
  squire: handleSquireDeath,
  priest: handlePriestDeath,
  maiden: handleMaidenDeath,
  seraph: handleSeraphDeath,
  cholera: handleCholeraDeath,
  spite_beast: handleSpiteBeastDeath,
  devouring_wound: handleDevouringWoundDeath,
  omen_womb: handleOmenWombDeath,
  stellar_cocoon: handleStellarCocoonDeath,
  devouring_graft: handleDevouringGraftDeath,
  groaning_coffin: handleGroaningCoffinDeath,
  budding_hydra: handleBuddingHydraDeath,
} satisfies Partial<Record<UnitId, DeathHandler>>;

export type DeathHandlerUnitId = keyof typeof UNIT_DEATH_HANDLERS;

export function getDeathHandler(id: UnitId): DeathHandler | undefined {
  return Object.hasOwn(UNIT_DEATH_HANDLERS, id)
    ? UNIT_DEATH_HANDLERS[id as DeathHandlerUnitId]
    : undefined;
}

export {
  handleEquipDeath,
  SPAWN_ALLY_REACTIONS,
  PERSISTENT_ALLY_REACTIONS,
  type AllyReactionCtx,
} from "./battle-deaths-effects";
