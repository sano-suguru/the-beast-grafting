# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"The Beast Grafter" (死獣接合術師) — a text-based, async auto-battler browser game (Super Auto Pets-like) with a gothic dark fantasy theme. Built as a Preact SPA deployed to Cloudflare Workers.

## Commands

コマンド一覧は @package.json scripts を参照。

単一テストファイル実行: `pnpm vitest run src/app/engine/battle.test.ts`

## Architecture

### Layers

- **`src/app/`** — Client-side Preact SPA
  - **`state/`** — Global state via `@preact/signals` (no store library). All signals live in `game-store.ts`; mutations are split across `game-actions.ts`, `shop-actions.ts`, `card-actions.ts`, `battle-actions.ts`, `undo-actions.ts`.
  - **`engine/`** — Pure game logic (battle simulation, shop effects, death resolution). Deterministic, no UI dependencies. Battle runs produce an array of `BattleFrame`s that the visualizer replays.
  - **`battle-worker/`** — Web Worker that runs battle simulation off the main thread. `client.ts` is the main-thread interface; `worker.ts` runs the engine.
  - **`screens/`** — Full-page screen components switched by `phase` signal in `app.tsx`.
  - **`components/`** — Reusable UI components (cards, badges, icons).
  - **`data/`** — Static game data definitions (units, items, origins, church units).
  - **`types/`** — Shared TypeScript types for the client.
- **`src/worker/`** — Cloudflare Worker backend (Hono). API routes in `api.ts`, entry in `index.ts`.
- **`src/db/`** — Drizzle ORM schema (SQLite/D1). Single `runs` table for async PvP board snapshots.
- **`src/shared/`** — Code shared between client and worker (error types, logger).
- **`e2e/`** — Playwright end-to-end tests.

### Key Patterns

- **No throw/try-catch**: oxlint (`eslint-js/no-restricted-syntax` via JS plugin) enforces using `neverthrow` Result types instead. Error types are defined in `src/shared/errors.ts` (`GameError`, `InfraError`). Use `ok()`, `err()`, `fromThrowable()`.
- **Battle simulation is frame-based**: `battle.ts` produces `BattleFrame[]` via `BattleContext`. Each frame snapshots both boards + a log entry + per-unit actions. The visualizer replays these frames for animation.
- **Signals-based state**: No Redux/Zustand. State is `@preact/signals` signals in `game-store.ts`. Screens read signals directly; action modules mutate them.
- **Vite-plus**: Uses `vite-plus` (vp) as a wrapper around Vite for dev/build/lint/fmt/check commands. Config is in `vite.config.ts`.
- **Fail-fast over defensive fallbacks**: バグを隠す防御的フォールバックよりフェイルファストを優先する。
  - ハードコードIDなど「失敗=データバグ」の箇所で `.unwrapOr(null)` や `?? fallback` を使わない。`invariant()` (`src/shared/invariant.ts`) でクラッシュさせる。
  - 型で必須と保証できるフィールドに `?? defaultValue` を書かない。型を正しく定義し、初期化時に保証する。
  - Result型のエラーブランチを無視しない。`.match()` で両方処理するか、データバグなら `invariant(result.isOk(), msg)` を使う。
  - UI層（`screens/`）では `console.warn` + graceful degradation は許容。エンジン層（`engine/`）では黙って飲み込まない。
  - 外部入力（localStorage, Worker message, API response）のフォールバックは正当。

### Configs

以下の設定は各設定ファイルを参照: @package.json, @.oxlintrc.json, @vite.config.ts, @tsconfig.app.json, @.dependency-cruiser.cjs

### Testing

- テストヘルパー: `src/app/engine/test-helpers.ts`
- state テストでは `beforeEach` で全シグナルを初期状態にリセット
- 外部依存（audio 等）は `vi.mock()` でモック
- テストファイルは行数制限免除

## Game Design Reference

The full game design document is in `GDD.md` (Japanese). Key mechanics: shop phase (buy/sell/graft units), auto-battle phase (SAP-style combat), origin selection, equipment system, sanity/blood resources.

## Work Principles

- 発見した問題は自分の変更起因でなくても修正する。
- `pnpm check` の exit code が 0 になるまで完了と言わない。

## Communication

- Always respond in Japanese.
