import type { BoardUnit } from "../../shared/board-unit";
import { isEquipType } from "../../shared/equip-type";
import { UNITS } from "../../shared/data/units";
import { CHURCH_UNITS } from "../../shared/data/church-units";
import type { RegularUnitId, ChurchUnitId } from "../../shared/types";

const MAX_BOARD_SIZE = 5;
const MAX_ROUND = 20;

const STAT_CEILING_MULTIPLIER = 20;
const STAT_CEILING_BASE = 200;

function lookupMasterData(
  id: string,
): { name: string; baseAtk: number; baseHp: number; tier: number } | null {
  if (Object.hasOwn(UNITS, id)) return UNITS[id as RegularUnitId];
  if (Object.hasOwn(CHURCH_UNITS, id)) return CHURCH_UNITS[id as ChurchUnitId];
  return null;
}

function hasNumericFields(o: Record<string, unknown>): boolean {
  return (
    typeof o["baseAtk"] === "number" &&
    typeof o["baseHp"] === "number" &&
    typeof o["buffAtk"] === "number" &&
    typeof o["buffHp"] === "number" &&
    typeof o["tier"] === "number" &&
    typeof o["level"] === "number" &&
    typeof o["exp"] === "number"
  );
}

function hasRequiredFields(o: Record<string, unknown>): boolean {
  return (
    typeof o["id"] === "string" &&
    typeof o["name"] === "string" &&
    hasNumericFields(o) &&
    (isEquipType(o["equip"]) || o["equip"] === null) &&
    typeof o["uid"] === "string" &&
    typeof o["isChurch"] === "boolean" &&
    typeof o["skillText"] === "string" &&
    typeof o["lore"] === "string"
  );
}

function validateBoundedInt(val: number, min: number, max: number): boolean {
  return Number.isInteger(val) && val >= min && val <= max;
}

function validateMasterMatch(o: Record<string, unknown>): boolean {
  const master = lookupMasterData(o["id"] as string);
  if (!master) return false;
  if (o["name"] !== master.name || o["tier"] !== master.tier) return false;
  if (o["baseAtk"] !== master.baseAtk || o["baseHp"] !== master.baseHp) return false;

  const isFromChurch = Object.hasOwn(CHURCH_UNITS, o["id"] as string);
  if (o["isChurch"] !== isFromChurch) return false;
  return true;
}

function validateStatCeilings(o: Record<string, unknown>): boolean {
  const master = lookupMasterData(o["id"] as string);
  if (!master) return false;

  const buffAtk = o["buffAtk"] as number;
  const buffHp = o["buffHp"] as number;
  if (buffAtk < 0 || buffHp < 0) return false;

  const atkCeiling = master.baseAtk * STAT_CEILING_MULTIPLIER + STAT_CEILING_BASE;
  const hpCeiling = master.baseHp * STAT_CEILING_MULTIPLIER + STAT_CEILING_BASE;
  return master.baseAtk + buffAtk <= atkCeiling && master.baseHp + buffHp <= hpCeiling;
}

function validateBoardUnit(u: unknown): u is BoardUnit {
  if (typeof u !== "object" || u === null) return false;
  const o = u as Record<string, unknown>;
  if (!hasRequiredFields(o)) return false;
  if (!validateBoundedInt(o["exp"] as number, 0, 2)) return false;
  if (!validateBoundedInt(o["level"] as number, 1, 3)) return false;

  const uid = o["uid"] as string;
  if (uid.length === 0 || uid.length > 32) return false;

  return validateMasterMatch(o) && validateStatCeilings(o);
}

export function validateSnapshotBody(
  body: unknown,
): body is { runId: string; round: number; board: BoardUnit[] } {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b["runId"] !== "string" || (b["runId"] as string).length === 0) return false;
  if (!validateBoundedInt(b["round"] as number, 1, MAX_ROUND)) return false;
  if (!Array.isArray(b["board"])) return false;
  const board = b["board"] as unknown[];
  return board.length >= 1 && board.length <= MAX_BOARD_SIZE && board.every(validateBoardUnit);
}

export function validateRound(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= MAX_ROUND;
}

export function validateNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}
