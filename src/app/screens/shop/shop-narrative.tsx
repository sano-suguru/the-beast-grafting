import { Info, AlertTriangle, Skull } from "lucide-preact";
import { toLifeTier } from "../../../shared/types";

export function ShopNarrative({ currentLife }: { currentLife: number }) {
  const tier = toLifeTier(currentLife);
  if (tier === "high") {
    return (
      <div className="text-parchment-muted text-body-xs flex flex-col items-center gap-1 text-center md:text-xs">
        <Info size={16} className="text-iron-light mb-1" />
        <span>
          闇市場の素体や薬品を<strong className="text-parchment-bright">タップして選択</strong>
        </span>
        <span>
          その後、解剖台の死体や枠を
          <strong className="text-parchment-bright">タップして配置・強化・接ぎ木</strong>する
        </span>
      </div>
    );
  }
  if (tier === "mid") {
    return (
      <div className="animate-fade-in text-gold-muted text-body-xs flex flex-col items-center gap-1 text-center md:text-xs">
        <AlertTriangle size={16} className="text-tarnished-gold-dim mb-1" />
        <span>教団の足音が近づいている……。</span>
        <span>急いで肉を繋ぎ合わせ、キメラを完成させろ。</span>
      </div>
    );
  }
  return (
    <div className="text-blood-bright text-body-xs flex animate-pulse flex-col items-center gap-1 text-center font-bold md:text-xs">
      <Skull size={16} className="text-blood-bright mb-1" />
      <span>もう時間がない！！ 奴らが来る！！</span>
      <span>早く……早く完成させろ！！！</span>
    </div>
  );
}
