import { DIAGNOSTIC_LANE_KINDS } from "@/domain/lab/lab-order-lane";
import { prisma } from "@/lib/prisma";

export async function loadMenuSurfaceCodes(): Promise<{ lab: string[]; diagnostic: string[] }> {
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

export async function findDiagnosticServiceIdsByModality(
  modalityCode: string,
): Promise<string[]> {
  const rows = await prisma.diagnosticService.findMany({
    where: { modality: { code: modalityCode } },
    select: { id: true },
  });
  return rows.map((row) => row.id);
}
