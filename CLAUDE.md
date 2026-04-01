# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"The Beast Grafter" (死獣接合術師) — a text-based, async auto-battler browser game (Super Auto Pets-like) with a gothic dark fantasy theme. Built as a Preact SPA deployed to Cloudflare Workers.

## Commands

コマンド一覧は @package.json scripts を参照。

- 単一テストファイル実行: `pnpm vitest run src/app/engine/battle.test.ts`
- `pnpm check` の内訳: `vp check`(lint+test+typecheck) → `knip`(未使用検出) → `jscpd`(コピペ検出) → `similarity-ts`(類似コード検出) → `depcruise`(依存境界検証)

## Architecture

### Layers

- **`src/engine/`** — Pure game logic (battle simulation, shop effects, death resolution). Deterministic, no UI/state/worker/DB dependencies. app・workerの両方から参照される独立層。
- **`src/app/`** — Client-side Preact SPA
  - **`state/`** — Global state via `@preact/signals` (no store library). All signals live in `game-store.ts`; mutations are split across `game-actions.ts`, `shop-actions.ts`, `card-actions.ts`, `battle-actions.ts`, `undo-actions.ts`.
  - **`engine/`** — Client-only engine (audio, particle system). No game logic.
  - **`api/`** — API client functions for server communication (`fetch.ts`, `pvp-client.ts`, `run-client.ts`).
  - **`screens/`** — Full-page screen components switched by `phase` signal in `app.tsx`.
  - **`components/`** — Reusable UI components (cards, badges, icons).
  - **`data/`** — Static game data definitions (units, items, origins, church units).
  - **`types/`** — Shared TypeScript types for the client.
- **`src/worker/`** — Cloudflare Worker backend (Hono). Entry in `index.ts`、ルートは `api.ts` で `/api` プレフィックス下に `auth/`, `pvp/`, `run/`, `shop/` をマウント。認証は `requireAuth`/`optionalAuth` ミドルウェア。
- **`src/db/`** — Drizzle ORM schema (SQLite/D1).
- **`src/shared/`** — Types, error definitions, data definitions, utilities. Thin layer shared between client and worker.
- **`e2e/`** — Playwright end-to-end tests.

### Key Patterns

- **No throw/try-catch**: oxlint (`eslint-js/no-restricted-syntax` via JS plugin) enforces using `neverthrow` Result types instead. Error types are defined in `src/shared/errors.ts` (`GameError`, `InfraError`). Use `ok()`, `err()`, `fromThrowable()`.
- **Battle simulation is frame-based**: `battle.ts` produces `BattleFrame[]` via `BattleContext`. Each frame snapshots both boards + a log entry + per-unit actions. The visualizer replays these frames for animation.
- **Signals-based state**: No Redux/Zustand. State is `@preact/signals` signals in `game-store.ts`. Screens read signals directly; action modules mutate them.
- **Vite-plus**: Uses `vite-plus` (vp) as a wrapper around Vite for dev/build/lint/fmt/check commands. Config is in `vite.config.ts`.
- **パスエイリアス**: `@/*` → `./src/*`（`tsconfig.app.json` で定義）。
- **oxlint複雑度制限**: max-lines: 300, max-lines-per-function: 50, max-depth: 4, complexity: 10（テストファイルは行数制限免除）。ファイル名はkebab-case必須。
- **Fail-fast over defensive fallbacks**: バグを隠す防御的フォールバックよりフェイルファストを優先する。
  - ハードコードIDなど「失敗=データバグ」の箇所で `.unwrapOr(null)` や `?? fallback` を使わない。`invariant()` (`src/shared/invariant.ts`) でクラッシュさせる。
  - 型で必須と保証できるフィールドに `?? defaultValue` を書かない。型を正しく定義し、初期化時に保証する。
  - Result型のエラーブランチを無視しない。`.match()` で両方処理するか、データバグなら `invariant(result.isOk(), msg)` を使う。
  - UI層（`screens/`）では `console.warn` + graceful degradation は許容。エンジン層（`engine/`）では黙って飲み込まない。
  - 外部入力（localStorage, Worker message, API response）のフォールバックは正当。

### Comments

- **コードで語れないことだけコメントする**: WHATコメント（コードの動作説明）は書かない。まず関数名・定数名・型で意図を表現し、それでも伝わらない設計由来（例: SAP準拠の理由）のみWHYコメントを書く。
- **JSDocはAPI境界に限定**: 公開関数・型フィールドの説明に使う。内部実装の逐次説明には使わない。

### LSP

- コード変更後の型エラー確認、シンボルの定義・参照の調査にはLSPツールを積極的に使う。Grep/Readで探す前にまずLSPを試すこと。
- リファクタリング前は `findReferences` で影響範囲を把握する。
- 呼び出し関係の調査には `incomingCalls` / `outgoingCalls` を使う。

### Configs

以下の設定は各設定ファイルを参照: @package.json, @.oxlintrc.json, @vite.config.ts, @tsconfig.app.json, @.dependency-cruiser.cjs

### Patches

- `undici@7.24.4.patch`: `isTraversableNavigable()` がTODOスタブで `true` を返し、Workersランタイムでfetch誤動作するため `false` に修正。

### Testing

- テストヘルパー: `src/engine/test-helpers.ts`（`makeUnit`, `makeBattleUnit`, `makeContext`, `makeEnemyTeam`）
- state テストでは `beforeEach` で `resetAllSignals()` を呼び全シグナルを初期状態にリセット
- 外部依存（audio 等）は `vi.mock()` でモック
- テストファイルは行数制限免除
- カバレッジ対象: `engine/`, `shared/data/`, `app/state/`, `worker/`

## Game Design Reference

The full game design document is in `GDD.md` (Japanese). Key mechanics: shop phase (buy/sell/graft units), auto-battle phase (SAP-style combat), origin selection, equipment system, sanity/blood resources.

## Work Principles

- 発見した問題は自分の変更起因でなくても修正する。
- `pnpm check` の exit code が 0 になるまで完了と言わない。

## Communication

- Always respond in Japanese.
