import type { ComponentType } from "preact";
import type { LucideProps } from "lucide-preact";

interface StatBadgeProps {
  icon: ComponentType<LucideProps>;
  value: number;
  className?: string;
}

export function StatBadge({ icon: Icon, value, className }: StatBadgeProps) {
  return (
    <div className={`flex items-center gap-0.5 font-bold ${className}`}>
      <Icon size={12} /> <span className="text-[10px] md:text-xs">{value}</span>
    </div>
  );
}
