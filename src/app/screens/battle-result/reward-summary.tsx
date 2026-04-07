import { Trophy, Heart } from "lucide-preact";

function deltaSign(value: number): string {
  if (value > 0) return "+";
  if (value === 0) return "±";
  return "";
}

function DeltaText({ value, color }: { value: number; color: string }) {
  const sign = deltaSign(value);
  return (
    <span className={`text-sm font-bold ${color}`}>
      {sign}
      {value}
    </span>
  );
}

export function RewardSummary({
  trophyDelta,
  lifeDelta,
}: {
  trophyDelta: number;
  lifeDelta: number;
}) {
  return (
    <div className="flex items-center gap-6">
      <div className="flex items-center gap-1.5">
        <Trophy size={14} className="text-amber-600" />
        <DeltaText value={trophyDelta} color="text-amber-500" />
      </div>
      <div className="flex items-center gap-1.5">
        <Heart size={14} className="text-rose-600" />
        <DeltaText value={lifeDelta} color="text-rose-500" />
      </div>
    </div>
  );
}
