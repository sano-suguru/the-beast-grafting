import { Info, AlertTriangle, Skull } from "lucide-preact";
import { toLifeTier } from "../../../shared/types";

export function ShopNarrative({ currentLife }: { currentLife: number }) {
  const tier = toLifeTier(currentLife);
  if (tier === "high") {
    return (
      <div className="flex flex-col items-center gap-1 text-center text-[10px] text-zinc-500 md:text-xs">
        <Info size={16} className="mb-1 text-zinc-600" />
        <span>
          闇市場の素体や薬品を<strong className="text-zinc-400">タップして選択</strong>
        </span>
        <span>
          その後、解剖台の死体や枠を
          <strong className="text-zinc-400">タップして配置・強化・接ぎ木</strong>する
        </span>
      </div>
    );
  }
  if (tier === "mid") {
    return (
      <div className="animate-fade-in flex flex-col items-center gap-1 text-center text-[10px] text-amber-600/80 md:text-xs">
        <AlertTriangle size={16} className="mb-1 text-amber-700" />
        <span>教団の足音が近づいている……。</span>
        <span>急いで肉を繋ぎ合わせ、キメラを完成させろ。</span>
      </div>
    );
  }
  return (
    <div className="flex animate-pulse flex-col items-center gap-1 text-center text-[10px] font-bold text-red-500 md:text-xs">
      <Skull size={16} className="mb-1 text-red-600" />
      <span>もう時間がない！！ 奴らが来る！！</span>
      <span>早く……早く完成させろ！！！</span>
    </div>
  );
}
