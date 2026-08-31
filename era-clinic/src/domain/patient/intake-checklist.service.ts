import { prisma } from "@/lib/prisma";
import { getDiagnosticCatalog } from "@/domain/catalog/diagnostic-catalog";
import {
  GYN_OR_URO_SLOT,
  NAFTA_INTAKE_SLOT_CODES,
  PKG_NAFTA_INTAKE,
  naftaIntakeSlotKind,
  naftaIntakeSlotTitle,
  resolveNaftaIntakeCode,
  type NaftaIntakeSlotCode,
} from "@/lib/import/nafta-intake-map";

export type IntakeChecklistStatus = "DONE" | "ORDERED" | "MISSING";

export type IntakeChecklistItem = {
  slot: NaftaIntakeSlotCode;
  resolvedCode: string;
  kind: "visit" | "lab" | "imaging";
  title: { en: string; ru: string; az: string };
  status: IntakeChecklistStatus;
  href: string | null;
  recordId: string | null;
};

export type IntakeChecklist = {
  packageCode: string;
  packageTitle: { en: string; ru: string; az: string } | null;
  items: IntakeChecklistItem[];
};

const LAB_DONE = new Set(["RESULT_READY", "PUBLISHED", "COMPLETED"]);
const LAB_ORDERED = new Set(["ORDERED", "COLLECTED", "IN_PROGRESS"]);
const VISIT_DONE = new Set(["COMPLETED"]);
const VISIT_OPEN = new Set(["IN_PROGRESS"]);

function labStatus(status: string): IntakeChecklistStatus {
  if (LAB_DONE.has(status)) return "DONE";
  if (LAB_ORDERED.has(status)) return "ORDERED";
  return "MISSING";
}

function visitStatus(status: string): IntakeChecklistStatus {
  if (VISIT_DONE.has(status)) return "DONE";
  if (VISIT_OPEN.has(status)) return "ORDERED";
  return "MISSING";
}

type EpisodeScope = { clinicalEpisodeId: string };

async function findLabOrder(
  patientRefId: string,
  testCode: string,
  episode?: EpisodeScope,
): Promise<{ id: string; status: string } | null> {
  const episodeFilter = episode ? { clinicalEpisodeId: episode.clinicalEpisodeId } : {};
  const byItem = await prisma.labOrder.findFirst({
    where: {
      patientRefId,
      ...episodeFilter,
      items: { some: { serviceCode: testCode } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (byItem) return byItem;
  return prisma.labOrder.findFirst({
    where: {
      patientRefId,
      ...episodeFilter,
      OR: [
        { testCode },
        { testCode: { startsWith: `${testCode},` } },
        { testCode: { endsWith: `,${testCode}` } },
      ],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
}

async function findVisitByServiceCode(
  patientRefId: string,
  serviceCode: string,
  episode?: EpisodeScope,
): Promise<{ id: string; status: string } | null> {
  const line = await prisma.visitServiceLine.findFirst({
    where: {
      serviceCode,
      visit: {
        patientRefId,
        ...(episode ? { clinicalEpisodeId: episode.clinicalEpisodeId } : {}),
      },
    },
    orderBy: { visit: { createdAt: "desc" } },
    select: { visit: { select: { id: true, status: true } } },
  });
  return line?.visit ?? null;
}

async function findAttendingOrAnyVisit(
  patientRefId: string,
  episode?: EpisodeScope,
): Promise<{ id: string; status: string } | null> {
  return prisma.visit.findFirst({
    where: {
      patientRefId,
      status: { not: "CANCELLED" },
      ...(episode ? { clinicalEpisodeId: episode.clinicalEpisodeId } : {}),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
}

async function findGynOrUroVisit(
  patientRefId: string,
  sex: string | null | undefined,
  episode?: EpisodeScope,
): Promise<{ id: string; status: string; resolvedCode: string } | null> {
  const resolved = resolveNaftaIntakeCode(GYN_OR_URO_SLOT, sex);
  if (resolved === "GYN-VISIT" || resolved === "URO-VISIT") {
    const byCode = await findVisitByServiceCode(patientRefId, resolved, episode);
    if (byCode) return { ...byCode, resolvedCode: resolved };
  }
  for (const code of ["GYN-VISIT", "URO-VISIT"] as const) {
    const byCode = await findVisitByServiceCode(patientRefId, code, episode);
    if (byCode) return { ...byCode, resolvedCode: code };
  }
  const specialtyNeedle =
    resolved === "URO-VISIT"
      ? ["uro", "уролог"]
      : resolved === "GYN-VISIT"
        ? ["gyn", "gine", "гинек"]
        : ["gyn", "gine", "uro", "уролог", "гинек"];
  const visits = await prisma.visit.findMany({
    where: {
      patientRefId,
      status: { not: "CANCELLED" },
      ...(episode ? { clinicalEpisodeId: episode.clinicalEpisodeId } : {}),
    },
    include: { practitioner: { select: { specialty: true } } },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  for (const v of visits) {
    const hay = (v.practitioner.specialty || "").toLowerCase();
    if (specialtyNeedle.some((n) => hay.includes(n))) {
      return {
        id: v.id,
        status: v.status,
        resolvedCode: resolved === "GYN-OR-URO" ? "GYN-OR-URO" : resolved,
      };
    }
  }
  return null;
}

/**
 * Derive Nafta check-in checklist from existing Visit / LabOrder rows.
 * When episodeId is set, only that care course counts (CLI-55).
 */
export async function getIntakeChecklist(
  patientRefId: string,
  opts?: { episodeId?: string | null },
): Promise<IntakeChecklist> {
  const episode = opts?.episodeId
    ? { clinicalEpisodeId: opts.episodeId }
    : undefined;
  const [catalog, patient] = await Promise.all([
    getDiagnosticCatalog(),
    prisma.patientRef.findUnique({
      where: { id: patientRefId },
      select: { id: true, sex: true },
    }),
  ]);
  const pkg = catalog.items.find((i) => i.code === PKG_NAFTA_INTAKE && i.kind === "package");
  const slots = (pkg?.includes?.length
    ? pkg.includes.filter((c): c is NaftaIntakeSlotCode =>
        (NAFTA_INTAKE_SLOT_CODES as readonly string[]).includes(c),
      )
    : [...NAFTA_INTAKE_SLOT_CODES]) as NaftaIntakeSlotCode[];

  const items: IntakeChecklistItem[] = [];
  for (const slot of slots) {
    const title = naftaIntakeSlotTitle(slot);
    const kind = naftaIntakeSlotKind(slot);
    const resolved = resolveNaftaIntakeCode(slot, patient?.sex);

    if (slot === "ECG-12" || slot === "USG-ABD") {
      const order = await findLabOrder(patientRefId, slot, episode);
      items.push({
        slot,
        resolvedCode: slot,
        kind,
        title,
        status: order ? labStatus(order.status) : "MISSING",
        href: order ? `/lab-orders?order=${order.id}` : null,
        recordId: order?.id ?? null,
      });
      continue;
    }

    if (slot === "SANATORIUM-INTAKE") {
      const byLine = await findVisitByServiceCode(
        patientRefId,
        "SANATORIUM-INTAKE",
        episode,
      );
      const visit = byLine ?? (await findAttendingOrAnyVisit(patientRefId, episode));
      items.push({
        slot,
        resolvedCode: "SANATORIUM-INTAKE",
        kind,
        title,
        status: visit ? visitStatus(visit.status) : "MISSING",
        href: visit ? `/visits/${visit.id}` : null,
        recordId: visit?.id ?? null,
      });
      continue;
    }

    const gyn = await findGynOrUroVisit(patientRefId, patient?.sex, episode);
    items.push({
      slot,
      resolvedCode: gyn?.resolvedCode ?? String(resolved),
      kind,
      title,
      status: gyn ? visitStatus(gyn.status) : "MISSING",
      href: gyn ? `/visits/${gyn.id}` : null,
      recordId: gyn?.id ?? null,
    });
  }

  return {
    packageCode: PKG_NAFTA_INTAKE,
    packageTitle: pkg?.title ?? {
      en: "Nafta initial diagnostic procedures",
      ru: "Nafta первичные диагностические процедуры",
      az: "İlkin diaqnostik prosedurlar",
    },
    items,
  };
}
