import { Droplet, Heart } from "lucide-preact";
import { RESOURCES, RESOURCE_MARKER_RE, type ResourceId } from "../../shared/data/resources";

const ICON_MAP: Record<string, typeof Droplet> = { Droplet, Heart };

export function ResourceText({ text }: { text: string }) {
  const parts = text.split(RESOURCE_MARKER_RE);
  return (
    <>
      {parts.map((part, i) => {
        const res = RESOURCES[part as ResourceId];
        if (!res) return part;
        const Icon = ICON_MAP[res.icon];
        return (
          <span key={i} className={`inline-flex items-baseline gap-px ${res.colorClass}`}>
            {Icon && <Icon size={10} className="self-center" />}
            {res.label}
          </span>
        );
      })}
    </>
  );
}
