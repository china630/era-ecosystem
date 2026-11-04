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
function codeIn(codes: string[]): Prisma.LabOrderWhereInput {
  return {
    OR: [
      { testCode: { in: codes } },
      { items: { some: { serviceCode: { in: codes } } } },
    ],
  };
}

const UNLINKED: Prisma.LabOrderWhereInput = {
  items: { none: { diagnosticServiceId: { not: null } } },
};

/** Unlinked rows whose text is an ECG / US / endoscopy study, not a lab panel code. */
const LOOSE_DIAGNOSTIC: Prisma.LabOrderWhereInput = {
  OR: ["ECG", "USG", "USM", "ENDO", "CARDIO"].flatMap((needle) => [
    { testCode: { contains: needle, mode: "insensitive" as const } },
    { items: { some: { serviceCode: { contains: needle, mode: "insensitive" as const } } } },
  ]),
};

export function labOrderLaneWhere(input: {
  kinds: string[];
  unclassified?: boolean;
  /** Catalog codes that belong on the diagnostics lane even with no service link. */
  diagnosticCodes?: string[];
  /** menuSurface=DIAGNOSTIC codes. Leave the analyses lane and join diagnostics. */
  surfaceDiagnosticCodes?: string[];
  /** menuSurface=LAB codes. Leave the diagnostics lane and join analyses. */
  surfaceLabCodes?: string[];
}): Prisma.LabOrderWhereInput | null {
  const kinds = input.kinds.map((k) => k.trim()).filter(Boolean);
  const diagnosticCodes = [...new Set((input.diagnosticCodes ?? []).map((c) => c.trim()).filter(Boolean))];
  const byKind: Prisma.LabOrderWhereInput | null = kinds.length
    ? {
        items: {
          some: {
            diagnosticService: { modality: { kind: { in: kinds } } },
          },
        },
      }
    : null;
  const isDiagnosticLane = kinds.some((k) =>
    (DIAGNOSTIC_LANE_KINDS as readonly string[]).includes(k),
  );
  const unlinkedMatch: Prisma.LabOrderWhereInput = diagnosticCodes.length
    ? { OR: [codeIn(diagnosticCodes), LOOSE_DIAGNOSTIC] }
    : LOOSE_DIAGNOSTIC;
  const unlinkedDiagnostic: Prisma.LabOrderWhereInput | null = isDiagnosticLane
    ? { AND: [UNLINKED, unlinkedMatch] }
    : null;
  const unclassified: Prisma.LabOrderWhereInput | null = input.unclassified
    ? { AND: [UNLINKED, { NOT: unlinkedMatch }] }
    : null;
  const parts = [byKind, unlinkedDiagnostic, unclassified].filter(
    (part): part is Prisma.LabOrderWhereInput => part != null,
  );
  if (parts.length === 0) return null;
  let where: Prisma.LabOrderWhereInput = parts.length === 1 ? parts[0]! : { OR: parts };
  const diagnosticSurface = [...new Set((input.surfaceDiagnosticCodes ?? []).map((c) => c.trim()).filter(Boolean))];
  const labSurface = [...new Set((input.surfaceLabCodes ?? []).map((c) => c.trim()).filter(Boolean))];
  if (!isDiagnosticLane && diagnosticSurface.length > 0) {
    where = { AND: [where, { NOT: codeIn(diagnosticSurface) }] };
  }
  if (!isDiagnosticLane && labSurface.length > 0) {
    where = { OR: [where, codeIn(labSurface)] };
  }
  if (isDiagnosticLane && labSurface.length > 0) {
    where = { AND: [where, { NOT: codeIn(labSurface) }] };
  }
  if (isDiagnosticLane && diagnosticSurface.length > 0) {
    where = { OR: [where, codeIn(diagnosticSurface)] };
  }
  return where;
}

export async function loadMenuSurfaceCodes(): Promise<{ lab: string[]; diagnostic: string[] }> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.diagnosticService.findMany({
    where: { menuSurface: { in: ["LAB", "DIAGNOSTIC"] } },
    select: { code: true, serviceCode: true, menuSurface: true },
  });
  const codes = (surface: string) => [
    ...new Set(
      rows
        .filter((row) => row.menuSurface === surface)
        .flatMap((row) => [row.code, row.serviceCode].filter(Boolean)),
    ),
  ];
  return { lab: codes("LAB"), diagnostic: codes("DIAGNOSTIC") };
}

export async function loadDiagnosticLaneCodes(): Promise<string[]> {
  const { prisma } = await import("@/lib/prisma");
  const rows = await prisma.diagnosticService.findMany({
    where: {
      OR: [
        { menuSurface: "DIAGNOSTIC" },
        {
          menuSurface: null,
          modality: { kind: { in: [...DIAGNOSTIC_LANE_KINDS] } },
        },
      ],
    },
    select: { code: true, serviceCode: true, menuSurface: true },
  });
  const codes = rows
    .filter((row) => row.menuSurface !== "LAB")
    .flatMap((row) => [row.code, row.serviceCode].filter(Boolean));
  return [...new Set(codes)];
}
