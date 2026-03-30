import { battleError, battleBusy } from "../state/game-store";
import { retryBattle, abandonBattle } from "../state/battle-actions";

export function BattleLoadingScreen() {
  const error = battleError.value;
  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 font-serif text-zinc-300">
        <p className="text-lg text-red-800">……術式が乱れた。瘴気が濃すぎる。</p>
        <p className="text-xs text-zinc-600">サーバーとの接続に失敗しました</p>
        <div className="flex gap-4">
          <button
            disabled={battleBusy.value}
            onClick={retryBattle}
            className="cursor-pointer rounded border border-red-900 bg-red-950/30 px-6 py-2 text-xs font-bold text-red-500 transition-all hover:bg-red-950/50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            もう一度試みる
          </button>
          <button
            onClick={abandonBattle}
            className="cursor-pointer rounded border border-zinc-700 bg-zinc-800 px-6 py-2 text-xs text-zinc-400 transition-colors hover:bg-zinc-700 active:scale-95"
          >
            撤退する
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-zinc-950 font-serif">
      <p className="animate-pulse text-zinc-400">接合体が胎動している……</p>
      <p className="text-[10px] text-zinc-600">通信中</p>
    </div>
  );
}
