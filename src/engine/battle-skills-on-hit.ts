import type { UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import {
  pushFrame,
  runWithBrainsRepeat,
  takeDamage,
  enemyPrefix,
  seg,
  buffAction,
  skillAction,
  skillDamageActions,
} from "./battle-context";
import { mustGet } from "../shared/invariant";
import { resolveDeaths } from "./battle-deaths";
import {
  atLevel,
  TEMPLAR,
  STITCHED_TWIN,
  FLAYED_SAINT,
  FLAGELLANT,
  TUMOR_GUARDIAN,
} from "../shared/skill-params";

type HitCtx = {
  defender: BattleUnit;
  board: BattleUnit[];
  idx: number;
  prefix: string;
  isPlayer: boolean;
  ctx: BattleContext;
  depth: number;
};

type HitHandler = (h: HitCtx) => void;

const HIT_HANDLERS = {
  templar: applyTemplarHit,
  stitched_twin: applyStitchedTwinHit,
  flayed_saint: applyFlayedSaintHit,
  flagellant: applyFlagellantHit,
  puppeteer: applyPuppeteerHit,
  tumor_guardian: applyTumorGuardianHit,
} satisfies Partial<Record<UnitId, HitHandler>>;

type HitHandlerUnitId = keyof typeof HIT_HANDLERS;

function getHitHandler(id: UnitId): HitHandler | undefined {
  return Object.hasOwn(HIT_HANDLERS, id) ? HIT_HANDLERS[id as HitHandlerUnitId] : undefined;
}

// on-hitハンドラはresolveDeathsを呼ばない: resolveClash側でclash→onHit→resolveDeathsの順序を保証する
export function applyOnHitSkills(
  defender: BattleUnit,
  board: BattleUnit[],
  isPlayer: boolean,
  ctx: BattleContext,
  depth = 0,
) {
  if (defender.hp <= 0) return;
  const idx = board.indexOf(defender);
  if (idx === -1) return;
  const handler = getHitHandler(defender.id);
  if (!handler) return;
  const prefix = enemyPrefix(isPlayer);
  const h: HitCtx = { defender, board, idx, prefix, isPlayer, ctx, depth };
  runWithBrainsRepeat(defender, board, idx, () => handler(h));
}

function applyTemplarHit({ defender: u, prefix, ctx }: HitCtx) {
  const b = atLevel(TEMPLAR.atkBuff, u.level);
  u.atk += b;
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "が傷を受け、嗤う。", seg.s(`+${b}/+0`)],
    "skill",
    {
      [u.uid]: buffAction({ atk: b, hp: 0 }, u.uid),
    },
  );
}

function applyStitchedTwinHit({ defender: u, prefix, ctx }: HitCtx) {
  const b = atLevel(STITCHED_TWIN.atkBuff, u.level);
  u.atk += b;
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "の縫い目が引き攣り、牙を剥く。", seg.s(`+${b}/+0`)],
    "skill",
    {
      [u.uid]: buffAction({ atk: b, hp: 0 }, u.uid),
    },
  );
}

function applyFlayedSaintHit({ defender: u, board, idx, prefix, ctx }: HitCtx) {
  const behind = board[idx + 1];
  if (!behind || behind.hp <= 0) return;
  const b = atLevel(FLAYED_SAINT.buff, u.level);
  behind.atk += b.atk;
  behind.hp += b.hp;
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "の痛みが後方の",
      seg.u(behind.name),
      "を駆り立てる。",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    {
      [u.uid]: skillAction(),
      [behind.uid]: buffAction(b, u.uid),
    },
  );
}

function applyFlagellantHit({ defender: u, board, idx, prefix, ctx }: HitCtx) {
  const behind = board[idx + 1];
  if (!behind || behind.hp <= 0) return;
  const b = atLevel(FLAGELLANT.buff, u.level);
  behind.atk += b.atk;
  behind.hp += b.hp;
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "の背が裂ける。血飛沫を浴びた",
      seg.u(behind.name),
      "が昂ぶる。",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    {
      [behind.uid]: buffAction(b, u.uid),
    },
  );
}

function applyPuppeteerHit({ defender: u, prefix, ctx }: HitCtx) {
  if (u.skillUses <= 0) return;
  if (u.equip === "corpse_wax") return;
  u.skillUses -= 1;
  u.equip = "corpse_wax";
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "の糸が軋む。崩れた肉が蝋と化して纏いつく。",
      " + ",
      seg.e("屍蝋の盾"),
    ],
    "skill",
    { [u.uid]: skillAction() },
  );
}

function applyTumorGuardianHit({ defender: u, isPlayer, ctx }: HitCtx) {
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  const alive = enemyBoard.filter((e) => e.hp > 0);
  if (alive.length === 0) return;
  const target = mustGet(alive, Math.floor(ctx.rng.next() * alive.length), "tumor_guardian target");
  const dmg = atLevel(TUMOR_GUARDIAN.damage, u.level);
  const hpBefore = target.hp;
  takeDamage(target, dmg, ctx, u.uid);
  const prefix = enemyPrefix(isPlayer);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "の瘤が脈打つ。",
      seg.u(target.name),
      "に毒液が飛び散る。",
      seg.hp(`${hpBefore}→${Math.max(0, target.hp)}`),
    ],
    "skill",
    skillDamageActions(u, target, dmg),
  );
  resolveDeaths(ctx);
}
