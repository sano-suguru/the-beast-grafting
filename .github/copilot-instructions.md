# Copilot Instructions

"The Beast Grafter" (死獣接合術師) — a text-based async auto-battler (Super Auto Pets-like) built as a Preact SPA deployed to Cloudflare Workers.

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build
pnpm test           # watch mode
pnpm test:unit      # run unit tests once
pnpm lint           # lint only
pnpm check          # full CI: lint + test + typecheck + knip + jscpd + similarity + depcruise

# Single test file
pnpm vitest run src/engine/battle.test.ts

# E2E
pnpm test:e2e
```

`pnpm check` must exit 0 before a task is considered complete.

## Architecture

Source is split into five strict layers enforced by `dependency-cruiser`:

| Layer | Path | Role |
|---|---|---|
| `engine` | `src/engine/` | Pure game logic (battle sim, shop effects). No UI, no signals, no DB. Used by both `app` and `worker`. |
| `shared` | `src/shared/` | Types, error defs, data utilities. No dependencies on other layers. |
| `app` | `src/app/` | Preact SPA. Sub-layers: `state/`, `api/`, `screens/`, `components/`, `engine/` (audio/particles), `data/`. |
| `worker` | `src/worker/` | Cloudflare Worker backend (Hono). Routes under `/api`: `auth/`, `pvp/`, `run/`, `shop/`, `lore/`. |
| `db` | `src/db/` | Drizzle ORM schema (SQLite/D1). Only `worker` may import from here. |

**Key dependency rules (violations = CI failure):**
- `app` → `worker` and `worker` → `app`: forbidden
- `app` → `db`: forbidden (only `worker` can access DB)
- `shared` and `engine` → `app`/`worker`/`db`: forbidden
- `app/state` → `app/engine` (audio/particles): forbidden — audio must be called from `screens/`, not state actions
- `app/api` → `app/state`: forbidden — API clients are pure fetch functions; side effects go in action files
- `app/components` → `app/screens`: forbidden
- No circular dependencies
- No barrel imports via `index.ts` (except `src/app/types/index.ts`)

## Key Conventions

### No throw / try-catch
`oxlint` bans `ThrowStatement` and `TryStatement`. Use `neverthrow` instead:
- `ok(value)`, `err(error)` for Results
- `fromThrowable()` / `safeAsync()` to wrap third-party code
- Error types: `GameError` and `InfraError` in `src/shared/errors.ts`
- Use `invariant(condition, msg)` from `src/shared/invariant.ts` for "this can only fail if there's a bug" assertions — it intentionally throws
- Never use `.unwrapOr(null)` or `?? fallback` to silence Result errors from known-good data; use `invariant(result.isOk(), msg)` instead

### Signals state (no Redux/Zustand)
All game state is `@preact/signals` signals in `src/app/state/game-store.ts`.
- **Game logic signals** (`phase`, `blood`, `life`, `board`, etc.): mutate only through action functions in `game-actions.ts`, `shop-actions.ts`, `card-actions.ts`, `battle-actions.ts`, `undo-actions.ts`
- **UI-only signals** (`showAccountOverlay`, `editingName`, `showRetireConfirm`, etc.): `screens/` and `components/` may set `.value` directly
- Tests: call `resetAllSignals()` in `beforeEach`

### Audio pattern
- **UI feedback sounds** (navigation, toggles — fixed SE): call `initAudio()` + `playSE()` directly from `screens/`
- **Action-result sounds** (buy/sell/roll — sound depends on outcome): action functions return `SoundResult` (a `Promise<SoundType | null>`); `screens/` consumes with `playSEFrom()`

### Battle simulation
`src/engine/battle.ts` produces `BattleFrame[]` via `BattleContext`. Each frame snapshots both boards + a log entry + per-unit actions. The client replays frames for animation.

- AoE buffs/damage: use `aoeBuffActions()` / `aoeDamageActions()` from `battle-context.ts` — include **all affected units**, not just the source
- Log segments in `pushFrame`: use `seg.u()` for unit names, `seg.e()` for equipment/effect names, `seg.s()` for stat values, `seg.hp()` for HP transitions (X→Y). Never embed numbers in plain strings.

### Registry file splitting
When handler registry files (`battle-skills.ts`, `battle-deaths-handlers.ts`, etc.) exceed ~200 lines, extract handler implementations into `*-{category}.ts` files. Keep the registry object and dispatcher in the original file.

### Linting limits (applied via `vite-plus`)
- `max-lines`: 300 (test files exempt)
- `max-lines-per-function`: 50 (test files exempt)
- `max-depth`: 4
- `complexity`: 10
- Filenames: kebab-case only
- No `console.*` (except `src/engine/sim/`)
- No dynamic `import()`

### Testing
- Test helpers: `src/engine/test-helpers.ts` — `makeUnit`, `makeBattleUnit`, `makeContext`, `makeEnemyTeam`
- Worker tests using Miniflare/D1: name files `*.d1.test.ts`; plain worker unit tests: `*.test.ts`
- `*.d1.test.ts` files run in a separate Vitest project (`worker-db`) using `pool: "forks"` with `maxWorkers: 1`
- Mock external dependencies (audio, etc.) with `vi.mock()`

### Path alias
`@/*` resolves to `./src/*` (defined in `tsconfig.app.json`).

### Narrative / log text
Show, don't tell — use concrete imagery rather than explanations in battle logs and lore text.
