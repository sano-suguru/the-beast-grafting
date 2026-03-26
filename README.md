# The Beast Grafter -死獣接合術師-

> Text-based async auto-battler browser game with a gothic dark fantasy theme.

A Super Auto Pets-like strategy game where you play as a mad scientist grafting together monstrous chimeras in a plague-ridden, dark fantasy city — all while hiding from the Church's Inquisitors.

## Overview

Build a team of up to 5 chimeras by purchasing, leveling, and grafting corpses in the shop phase, then watch them battle automatically. Win 10 fights to complete your masterpiece; lose all sanity and face the flames.

**Core loop:**

1. **Shop phase** — Buy units with Blood Drops, graft duplicates to level them up, equip alchemical items, freeze the market
2. **Battle phase** — Both sides fight automatically; view animated frame-by-frame replay
3. **Repeat** — 10 victories to win, 0 sanity to lose

## Tech Stack

| Layer           | Technology                                |
| --------------- | ----------------------------------------- |
| Frontend        | Preact + @preact/signals, Tailwind CSS v4 |
| Routing / State | Signal-based (no store library)           |
| Backend         | Hono on Cloudflare Workers                |
| Database        | Cloudflare D1 + Drizzle ORM               |
| Build           | Vite (via vite-plus), TypeScript          |
| Error handling  | neverthrow (no throw/try-catch)           |
| Testing         | Vitest, Playwright                        |

## Getting Started

**Prerequisites:** Node.js 20+, pnpm 10+

```bash
pnpm install
pnpm dev          # Start dev server
pnpm test         # Run unit tests (watch mode)
pnpm check        # Full check: lint + types + tests + deps
```

## Architecture

```
src/
├── app/           # Preact SPA
│   ├── state/     # @preact/signals global store + action modules
│   ├── engine/    # Pure game logic (battle simulation, frame-based)
│   ├── screens/   # Full-page screen components
│   ├── components/# Reusable UI components
│   └── data/      # Static game data (units, items, origins)
├── worker/        # Cloudflare Worker backend (Hono)
├── db/            # Drizzle ORM schema (D1/SQLite)
└── shared/        # Shared types and utilities
```

Battle simulation is **frame-based**: `engine/battle.ts` produces `BattleFrame[]` that the visualizer replays for animation, keeping game logic and UI fully decoupled.

---

## 日本語

**The Beast Grafter -死獣接合術師-** は、テキストベースの非同期対戦オートバトラーです。

疫病と魔女狩りが蔓延る中世ゴシックファンタジーの世界で、「死獣接合術師（ビーストグラフター）」として死体を縫い合わせ、最強のキメラを作り上げてください。

### ゲームの流れ

- **遺体安置所（ショップ）:** 毎夜支給される「鮮血10滴」を使い、キメラを購入・接ぎ木・装備。同種素体を重ねてLv3まで強化。「墓暴き」でラインナップを更新、「防腐処理」で商品を翌夜へ保持。
- **狂宴（バトル）:** 双方のキメラが自動戦闘。教団の審問官と同業者の狂った術師が立ちはだかる。
- **目標:** 10勝で傑作完成。正気度0で終了。

### グラフターの素性（プレイスタイル）

- 卑劣なる死体泥棒 — リロール特化
- 堕ちた異端審問官 — レイトゲーム特化
- 狂気の解剖医 — 売買特化
- 深淵の邪教徒 — ハイリスク・ハイリターン

---

## License

Copyright (C) 2026 The Beast Grafter Authors

This program is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

See [LICENSE](LICENSE) for the full license text.
