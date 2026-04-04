export type ResourceId = "blood" | "sanity";

export const RESOURCES: Record<ResourceId, { label: string; icon: string; colorClass: string }> = {
  blood: { label: "鮮血", icon: "Droplet", colorClass: "text-red-700" },
  sanity: { label: "正気度", icon: "Heart", colorClass: "text-red-500" },
};

export const RESOURCE_MARKER_RE = /\{(blood|sanity)\}/;
