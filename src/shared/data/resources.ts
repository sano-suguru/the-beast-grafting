export type ResourceId = "blood" | "life";

export const RESOURCES: Record<ResourceId, { label: string; icon: string; colorClass: string }> = {
  blood: { label: "鮮血", icon: "Droplet", colorClass: "text-blood-dim" },
  life: { label: "生命力", icon: "Heart", colorClass: "text-blood-bright" },
};

export const RESOURCE_MARKER_RE = /\{(blood|life)\}/;
