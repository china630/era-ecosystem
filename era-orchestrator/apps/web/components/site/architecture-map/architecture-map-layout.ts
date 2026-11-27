/** Fixed orbital layout for the public architecture map (viewBox 1200×640). */

export const ARCH_VIEW_W = 1200;
export const ARCH_VIEW_H = 640;

export type ArchNodeShape = "core" | "satellite" | "pill";

export type ArchLayoutNode = {
  key: string;
  x: number;
  y: number;
  shape: ArchNodeShape;
  /** Circle radius for core / satellite */
  r?: number;
  pillW?: number;
  pillH?: number;
  labelSide?: "top" | "bottom" | "left" | "right";
};

export const ARCHITECTURE_NODE_LAYOUT: Record<string, ArchLayoutNode> = {
  finance_core: { key: "finance_core", x: 510, y: 315, shape: "core", r: 64, labelSide: "top" },
  industry_banking: { key: "industry_banking", x: 820, y: 315, shape: "core", r: 54, labelSide: "top" },
  banking_dbo: { key: "banking_dbo", x: 945, y: 248, shape: "satellite", r: 26, labelSide: "right" },
  industry_hotel_pms: { key: "industry_hotel_pms", x: 510, y: 158, shape: "satellite", r: 28, labelSide: "top" },
  industry_fnb_pos: { key: "industry_fnb_pos", x: 365, y: 218, shape: "satellite", r: 26, labelSide: "left" },
  industry_clinic: { key: "industry_clinic", x: 650, y: 195, shape: "satellite", r: 26, labelSide: "top" },
  industry_construction: { key: "industry_construction", x: 230, y: 315, shape: "satellite", r: 26, labelSide: "left" },
  industry_auto_service: { key: "industry_auto_service", x: 290, y: 443, shape: "satellite", r: 26, labelSide: "bottom" },
  industry_wholesale: { key: "industry_wholesale", x: 415, y: 501, shape: "satellite", r: 26, labelSide: "left" },
  industry_logistics: { key: "industry_logistics", x: 555, y: 530, shape: "satellite", r: 26, labelSide: "left" },
  industry_retail: { key: "industry_retail", x: 690, y: 492, shape: "satellite", r: 26, labelSide: "right" },
  platform_datahub: { key: "platform_datahub", x: 880, y: 505, shape: "satellite", r: 26, labelSide: "bottom" },
  industry_crm: { key: "industry_crm", x: 495, y: 24, shape: "pill", pillW: 200, pillH: 46 },
  platform_workforce: { key: "platform_workforce", x: 38, y: 501, shape: "pill", pillW: 168, pillH: 46 },
};

/** Module / channel nodes that render without a SiteSatellitePublic row. */
export const ARCHITECTURE_MODULE_NODE_KEYS = ["banking_dbo"] as const;

export const PLATFORM_ORCHESTRATOR_KEY = "platform_orchestrator";

export function archNodeCenter(key: string): { x: number; y: number } | null {
  const n = ARCHITECTURE_NODE_LAYOUT[key];
  if (!n) return null;
  if (n.shape === "pill") {
    return { x: n.x + (n.pillW ?? 0) / 2, y: n.y + (n.pillH ?? 0) / 2 };
  }
  return { x: n.x, y: n.y };
}

/** Smooth curve between diagram nodes (orbital spokes). */
export function archLinkPath(fromKey: string, toKey: string): string | null {
  const a = archNodeCenter(fromKey);
  const b = archNodeCenter(toKey);
  if (!a || !b) return null;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const cx1 = a.x + dx * 0.35;
  const cy1 = a.y + dy * 0.05;
  const cx2 = b.x - dx * 0.35;
  const cy2 = b.y - dy * 0.05;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}

export function industryBundleKeys(
  industrySlug: string,
  items: { satelliteKey: string }[],
): string[] {
  const keys = new Set<string>(["finance_core", ...items.map((i) => i.satelliteKey)]);
  if (industrySlug === "banking") {
    keys.add("industry_banking");
    keys.add("banking_dbo");
    keys.add("platform_datahub");
  }
  return [...keys];
}