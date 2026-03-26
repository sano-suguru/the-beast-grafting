import { currentEnemyTeam } from "../state/game-store";
import { startActualBattle } from "../state/battle-actions";

export function PreBattleScreen() {
  return (
    <main className="animate-fade-in relative flex h-[100dvh] w-full flex-col items-center justify-center overflow-hidden bg-zinc-950 p-6 text-center font-serif text-zinc-300">
      <div className="max-w-md space-y-6 text-xs leading-loose tracking-wide text-zinc-400 md:text-base">
        <p>解剖台の血を洗い流し、あなたは外の暗闇へ目を向ける。</p>
        <p>完成した不完全なキメラたちは、新鮮な肉を求めて夜の街へと這い出していった。</p>
        <p className="mt-4 border-y border-red-900/30 py-4 font-bold text-red-800">
          今夜の狩りの気配：
          <br />
          <span className="mt-2 block text-sm tracking-widest text-red-500 md:text-lg">
            {currentEnemyTeam.value?.teamName}
          </span>
        </p>
        <p>……狂宴が始まる。</p>
      </div>
      <button
        onClick={startActualBattle}
        className="mt-12 cursor-pointer border border-red-900 bg-red-950/20 px-8 py-3 text-sm tracking-widest text-red-500 transition-all hover:bg-red-950/40"
      >
        結果を見届ける
      </button>
    </main>
  );
}
