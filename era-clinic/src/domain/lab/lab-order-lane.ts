import type { Prisma } from "@prisma/client";

/** Blood / urine panels. */
export const LAB_PANEL_KIND = "lab_panel";

/** Cabinet studies: USG, ECG, endoscopy. Not doctor visits. */
export const DIAGNOSTIC_LANE_KINDS = ["imaging", "functional", "endoscopy"] as const;

export type LabListLane = "lab" | "diagnostic";

export function parseLabListLane(raw: string | null | undefined): LabListLane {
  return raw === "diagnostic" ? "diagnostic" : "lab";
}

export function laneForServiceKind(kind: string | null | undefined): LabListLane {
  if (kind && (DIAGNOSTIC_LANE_KINDS as readonly string[]).includes(kind)) {
    return "diagnostic";
  }
  return "lab";
}

/** List + workflow modal. Unknown kind stays on the analyses lane. */
export function labOrderLaneHref(orderId: string, kind?: string | null): string {
  const lane = laneForServiceKind(kind);
  return `/lab-orders?lane=${lane}&order=${encodeURIComponent(orderId)}`;
}

/**
 * Analyses: lab panels, plus orders with no catalog service (they must not vanish).
 * Diagnostics: imaging / functional / endoscopy only. Package kind is in neither lane.
 */
export function labOrderLaneWhere(input: {
  kinds: string[];
  unclassified?: boolean;
}): Prisma.LabOrderWhereInput | null {
  const kinds = input.kinds.map((k) => k.trim()).filter(Boolean);
  const byKind: Prisma.LabOrderWhereInput | null = kinds.length
    ? {
        items: {
          some: {
            diagnosticService: { modality: { kind: { in: kinds } } },
          },
        },
      }
    : null;
  const unclassified: Prisma.LabOrderWhereInput | null = input.unclassified
    ? { items: { none: { diagnosticServiceId: { not: null } } } }
    : null;
  if (byKind && unclassified) return { OR: [byKind, unclassified] };
  return byKind ?? unclassified;
}
