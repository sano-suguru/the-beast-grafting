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
  handleHangedManDeath,
  handleSeraphDeath,
} from "./battle-deaths-handlers-unit";
import {
  handleGraftScionDeath,
  handleOmenWombDeath,
  handleStellarCocoonDeath,
  handleStarChildDeath,
  handleDevouringGraftDeath,
  handleBuddingHydraDeath,
} from "./battle-deaths-handlers-spawn";
import { handleAshFungusDeath } from "./battle-deaths-handlers-buff";

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
  hanged_man: handleHangedManDeath,
  seraph: handleSeraphDeath,
  graft_scion: handleGraftScionDeath,
  omen_womb: handleOmenWombDeath,
  stellar_cocoon: handleStellarCocoonDeath,
  star_child: handleStarChildDeath,
  devouring_graft: handleDevouringGraftDeath,
  budding_hydra: handleBuddingHydraDeath,
  ash_fungus: handleAshFungusDeath,
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
