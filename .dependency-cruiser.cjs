/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ── 循環依存の禁止 ──
    {
      name: "no-circular",
      severity: "error",
      comment: "循環依存を禁止する",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-barrel-imports",
      severity: "error",
      comment:
        "バレルファイル(index.ts)経由のインポートを禁止する（types/index.tsは型定義本体のため除外）",
      from: {},
      to: {
        path: "/index\\.ts$",
        pathNot: "^src/app/types/index\\.ts$",
      },
    },

    // ── トップレベルディレクトリ間の境界 ──
    {
      name: "no-app-to-worker",
      severity: "error",
      comment: "フロントエンド(app)からバックエンド(worker)への依存を禁止",
      from: { path: "^src/app" },
      to: { path: "^src/worker" },
    },
    {
      name: "no-worker-to-app",
      severity: "error",
      comment: "バックエンド(worker)からフロントエンド(app)への依存を禁止",
      from: { path: "^src/worker" },
      to: { path: "^src/app" },
    },
    {
      name: "no-app-to-db",
      severity: "error",
      comment: "フロントエンド(app)からDB層への依存を禁止",
      from: { path: "^src/app" },
      to: { path: "^src/db" },
    },
    {
      name: "no-db-to-app",
      severity: "error",
      comment: "DB層からフロントエンド(app)への依存を禁止",
      from: { path: "^src/db" },
      to: { path: "^src/app" },
    },
    {
      name: "no-db-to-worker",
      severity: "error",
      comment: "DB層からバックエンド(worker)への依存を禁止",
      from: { path: "^src/db" },
      to: { path: "^src/worker" },
    },
    {
      name: "no-shared-to-app",
      severity: "error",
      comment: "共有層(shared)からフロントエンド(app)への依存を禁止",
      from: { path: "^src/shared" },
      to: { path: "^src/app" },
    },
    {
      name: "no-shared-to-worker",
      severity: "error",
      comment: "共有層(shared)からバックエンド(worker)への依存を禁止",
      from: { path: "^src/shared" },
      to: { path: "^src/worker" },
    },
    {
      name: "no-shared-to-db",
      severity: "error",
      comment: "共有層(shared)からDB層への依存を禁止",
      from: { path: "^src/shared" },
      to: { path: "^src/db" },
    },

    // ── engine層の境界 ──
    {
      name: "no-app-to-engine",
      severity: "error",
      comment:
        "フロントエンド(app)はengine層に直接依存してはならない（shared経由でアクセスすること）",
      from: { path: "^src/app", pathNot: "\\.test\\.(ts|tsx)$" },
      to: { path: "^src/engine" },
    },
    {
      name: "no-engine-to-app",
      severity: "error",
      comment: "engine層はフロントエンド(app)に依存してはならない",
      from: { path: "^src/engine" },
      to: { path: "^src/app" },
    },
    {
      name: "no-engine-to-worker",
      severity: "error",
      comment: "engine層はバックエンド(worker)に依存してはならない",
      from: { path: "^src/engine" },
      to: { path: "^src/worker" },
    },
    {
      name: "no-engine-to-db",
      severity: "error",
      comment: "engine層はDB層に依存してはならない",
      from: { path: "^src/engine" },
      to: { path: "^src/db" },
    },
    {
      name: "no-shared-to-engine",
      severity: "error",
      comment: "共有層(shared)はengine層に依存してはならない",
      from: { path: "^src/shared" },
      to: { path: "^src/engine" },
    },
    {
      name: "no-db-to-engine",
      severity: "error",
      comment: "DB層はengine層に依存してはならない",
      from: { path: "^src/db" },
      to: { path: "^src/engine" },
    },

    // ── state層の境界 ──
    {
      name: "no-state-to-engine",
      severity: "error",
      comment: "state層はengine層に依存してはならない",
      from: { path: "^src/app/state" },
      to: { path: "^src/app/engine" },
    },

    // ── 内部レイヤー境界 ──
    {
      name: "no-data-to-upper-layers",
      severity: "error",
      comment: "データ層はengine/state/screens/componentsに依存してはならない",
      from: { path: "^src/(app/data|shared/data)" },
      to: { path: "^src/(app/|shared/)?(engine|state|screens|components)|^src/engine" },
    },
    {
      name: "no-engine-to-ui-layers",
      severity: "error",
      comment: "エンジン層(app内)はstate/screens/componentsに依存してはならない",
      from: { path: "^src/app/engine" },
      to: { path: "^src/app/(state|screens|components)" },
    },
    {
      name: "no-api-to-state",
      severity: "error",
      comment: "API層(app/api)はstate層に依存してはならない（副作用はaction層で処理すること）",
      from: { path: "^src/app/api" },
      to: { path: "^src/app/state" },
    },
    {
      name: "no-components-to-screens",
      severity: "error",
      comment: "再利用コンポーネントは画面コンポーネントに依存してはならない",
      from: { path: "^src/app/components" },
      to: { path: "^src/app/screens" },
    },
  ],
  options: {
    doNotFollow: {
      path: "node_modules",
    },
    tsConfig: {
      fileName: "tsconfig.app.json",
    },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      mainFields: ["module", "main", "types", "typings"],
      extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    },
    reporterOptions: {
      dot: {
        collapsePattern: "node_modules/(@[^/]+/[^/]+|[^/]+)",
      },
    },
  },
};
