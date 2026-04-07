import { useEffect } from "preact/hooks";
import { TIER_UNLOCK_TEXT, type UnlockableTier } from "../../../shared/data/tiers";
import { playSE } from "../../engine/audio";

export function TierUnlockBanner({ tier }: { tier: UnlockableTier }) {
  useEffect(() => {
    playSE("tier_unlock");
  }, [tier]);

  const text = TIER_UNLOCK_TEXT[tier];

  return (
    <p className="animate-fade-in text-center text-sm tracking-wider text-amber-700/80">
      <span className="mr-2 text-xs opacity-60">Tier {tier}</span>
      {text}
    </p>
  );
}
