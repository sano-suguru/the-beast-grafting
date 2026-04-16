import type { UnitId } from "../shared/types";
import type { BattleUnit, BattleContext } from "./battle-context";
import {
  pushFrame,
  getMult,
  takeDamage,
  enemyPrefix,
  seg,
  aoeBuffActions,
  buffAction,
  healAction,
  damageAction,
  skillAction,
} from "./battle-context";
import { mustGet } from "../shared/invariant";
import {
  atLevel,
  TEMPLAR,
  LEECH,
  STITCHED_TWIN,
  FLAYED_SAINT,
  FLAGELLANT,
  HOWLING_GIANT,
  TUMOR_GUARDIAN,
  DEAD_HAND,
} from "../shared/skill-params";

type HitCtx = {
  defender: BattleUnit;
  board: BattleUnit[];
  idx: number;
  prefix: string;
  isPlayer: boolean;
  ctx: BattleContext;
};

type HitHandler = (h: HitCtx) => void;

const HIT_HANDLERS = {
  templar: applyTemplarHit,
  leech: applyLeechHit,
  stitched_twin: applyStitchedTwinHit,
  flayed_saint: applyFlayedSaintHit,
  flagellant: applyFlagellantHit,
  howling_giant: applyHowlingGiantHit,
  tumor_guardian: applyTumorGuardianHit,
  amniotic_armor: applyAmnioticArmorHit,
  dead_hand: applyDeadHandHit,
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
) {
  if (defender.hp <= 0) return;
  const idx = board.indexOf(defender);
  if (idx === -1) return;
  const handler = getHitHandler(defender.id);
  if (!handler) return;
  const prefix = enemyPrefix(isPlayer);
  const mult = getMult(board, idx);
  const h: HitCtx = { defender, board, idx, prefix, isPlayer, ctx };
  for (let m = 0; m < mult; m++) handler(h);
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

function applyLeechHit({ defender: u, prefix, ctx }: HitCtx) {
  const b = atLevel(LEECH.hpBuff, u.level);
  u.hp += b;
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "が血を啜る。", seg.s(`+0/+${b}`)],
    "skill",
    {
      [u.uid]: healAction(b, u.uid),
    },
  );
}

function applyStitchedTwinHit({ defender: u, board, idx, prefix, ctx }: HitCtx) {
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
  const behind = board[idx + 1];
  if (behind && behind.hp > 0) {
    const dmg = 1;
    takeDamage(behind, dmg, u.uid);
    pushFrame(
      ctx,
      "skill",
      () => [
        prefix,
        seg.u(u.name),
        "がのたうち、",
        seg.u(behind.name),
        "に噛みつく。",
        seg.s(`${dmg}ダメージ`),
      ],
      "skill",
      {
        [behind.uid]: damageAction(dmg, u.uid),
      },
    );
  }
}

function applyFlayedSaintHit({ defender: u, isPlayer, prefix, ctx }: HitCtx) {
  const enemyBoard = isPlayer ? ctx.eBoard : ctx.pBoard;
  const alive = enemyBoard.filter((e) => e.hp > 0);
  if (alive.length === 0) return;
  const target = mustGet(alive, Math.floor(ctx.rng.next() * alive.length), "flayed_saint target");
  const dmg = atLevel(FLAYED_SAINT.damage, u.level);
  const hpBefore = target.hp;
  takeDamage(target, dmg, u.uid);
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "の肉片が弾け飛ぶ。",
      seg.u(target.name),
      seg.hp(`${hpBefore}→${Math.max(0, target.hp)}`),
    ],
    "skill",
    {
      [u.uid]: skillAction(),
      [target.uid]: damageAction(dmg, u.uid),
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

function applyHowlingGiantHit({ defender: u, board, prefix, ctx }: HitCtx) {
  const b = atLevel(HOWLING_GIANT.atkBuff, u.level);
  const buffed: BattleUnit[] = [];
  for (const ally of board) {
    if (ally.hp <= 0) continue;
    ally.atk += b;
    buffed.push(ally);
  }
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "が吼える。味方の腕が震え、拳が白む。", seg.s(`+${b}/+0`)],
    "skill",
    aoeBuffActions(u, buffed, { atk: b, hp: 0 }),
  );
}

function applyTumorGuardianHit({ defender: u, board, idx, prefix, ctx }: HitCtx) {
  const behind = board[idx + 1];
  if (!behind || behind.hp <= 0) return;
  const b = atLevel(TUMOR_GUARDIAN.buff, u.level);
  behind.atk += b.atk;
  behind.hp += b.hp;
  pushFrame(
    ctx,
    "skill",
    () => [
      prefix,
      seg.u(u.name),
      "の瘤が脈打つ。",
      seg.u(behind.name),
      "が変質する。",
      seg.s(`+${b.atk}/+${b.hp}`),
    ],
    "skill",
    { [behind.uid]: buffAction(b, u.uid) },
  );
}

function applyAmnioticArmorHit({ defender: u, prefix, ctx }: HitCtx) {
  if (u.skillUses <= 0) return;
  if (u.equip !== null) return;
  u.skillUses -= 1;
  u.equip = "corpse_wax";
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "の膜が硬化し、", seg.e("屍蝋"), "が纏う。"],
    "skill",
    { [u.uid]: { type: "buff", value: "屍蝋" } },
  );
}

function applyDeadHandHit({ defender: u, prefix, ctx }: HitCtx) {
  const hpGain = atLevel(DEAD_HAND.hpBuff, u.level);
  const atkGain = atLevel(DEAD_HAND.atkBuff, u.level);
  u.hp += hpGain;
  u.atk += atkGain;
  pushFrame(
    ctx,
    "skill",
    () => [prefix, seg.u(u.name), "が噛みつき返す。肉が膨れる。", seg.s(`+${atkGain}/+${hpGain}`)],
    "skill",
    { [u.uid]: buffAction({ atk: atkGain, hp: hpGain }, u.uid) },
  );
}
