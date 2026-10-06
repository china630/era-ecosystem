import { prisma } from "@/lib/prisma";
import {
  effectiveAutoFulfillment,
  resolveAutoBlockServiceCode,
} from "@/domain/sanatorium/package-auto-apply.service";

export type IntakeChecklistStatus = "DONE" | "ORDERED" | "MISSING";

export type IntakeChecklistItem = {
  /** Package block code from the current template. */
  slot: string;
  resolvedCode: string;
  kind: "visit" | "lab" | "imaging";
  title: { en: string; ru: string; az: string };
  status: IntakeChecklistStatus;
  href: string | null;
  recordId: string | null;
  /** Set on auto doctor visits when a slot is already booked (Asia/Baku instant). */
  scheduledAt: string | null;
};

export type IntakeChecklist = {
  packageCode: string;
  packageTitle: { en: string; ru: string; az: string } | null;
  items: IntakeChecklistItem[];
};

const LAB_DONE = new Set(["RESULT_READY", "PUBLISHED", "COMPLETED"]);
const LAB_ORDERED = new Set(["ORDERED", "COLLECTED", "IN_PROGRESS"]);

function labStatus(status: string): IntakeChecklistStatus {
  if (LAB_DONE.has(status)) return "DONE";
  if (LAB_ORDERED.has(status)) return "ORDERED";
  return "MISSING";
}

function lookupCodes(code: string): string[] {
  const c = code.trim();
  if (c === "CARDIO-ECG" || c === "ECG-12" || c === "ECG") {
    return ["CARDIO-ECG", "ECG-12", "ECG"];
  }
  if (c === "USG-ABD" || c === "USG") return ["USG-ABD", "USG"];
  return [c];
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
      status: { not: "CANCELLED" },
      items: { some: { serviceCode: { in: lookupCodes(testCode) } } },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
  if (byItem) return byItem;
  return prisma.labOrder.findFirst({
    where: {
      patientRefId,
      ...episodeFilter,
      status: { not: "CANCELLED" },
      OR: lookupCodes(testCode).flatMap((code) => [
        { testCode: code },
        { testCode: { startsWith: `${code},` } },
        { testCode: { endsWith: `,${code}` } },
      ]),
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
}

async function findVisit(
  patientRefId: string,
  serviceCode: string,
  episodeId: string,
): Promise<{ id: string; status: string; scheduledAt: Date | null } | null> {
  const visit = await prisma.visit.findFirst({
    where: {
      patientRefId,
      clinicalEpisodeId: episodeId,
      status: { not: "CANCELLED" },
      serviceLines: { some: { serviceCode } },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      appointment: { select: { scheduledAt: true } },
    },
  });
  if (!visit) return null;
  return {
    id: visit.id,
    status: visit.status,
    scheduledAt: visit.appointment?.scheduledAt ?? null,
  };
}

function emptyChecklist(packageCode = ""): IntakeChecklist {
  return { packageCode, packageTitle: null, items: [] };
}

/**
 * Auto analyses, diagnostics, and doctor visits from the current package template.
 * Shown only after the first care-team doctor. Visits appear without a clock;
 * the card books the slot later. Manual baths and physio stay off this list.
 */
export async function getIntakeChecklist(
  patientRefId: string,
  opts?: { episodeId?: string | null },
): Promise<IntakeChecklist> {
  const episodeId = opts?.episodeId?.trim();
  if (!episodeId) return emptyChecklist();

  const episode = await prisma.clinicalEpisode.findUnique({
    where: { id: episodeId },
    select: {
      programCode: true,
      organizationId: true,
      _count: { select: { careDoctors: true } },
    },
  });
  const programCode = episode?.programCode?.trim() ?? "";
  if (!episode || episode._count.careDoctors < 1 || !programCode) {
    return emptyChecklist(programCode);
  }

  const [template, patient] = await Promise.all([
    prisma.programTemplate.findFirst({
      where: {
        organizationId: episode.organizationId,
        code: programCode,
        isCurrent: true,
      },
      include: { procedures: { orderBy: { sortOrder: "asc" } } },
    }),
    prisma.patientRef.findUnique({
      where: { id: patientRefId },
      select: { sex: true },
    }),
  ]);
  if (!template) return emptyChecklist(programCode);

  const title = { en: template.name, ru: template.name, az: template.name };
  const items: IntakeChecklistItem[] = [];
  const seen = new Set<string>();

  for (const block of template.procedures) {
    const mode = block.assignMode;
    if (mode !== "AUTO_ON_OPEN" && mode !== "AUTO_DAY1") continue;
    const fulfillment = effectiveAutoFulfillment(block, patient?.sex);
    if (fulfillment !== "LAB_ORDER" && fulfillment !== "VISIT") continue;
    const serviceCode = resolveAutoBlockServiceCode(block.procedureCode, patient?.sex);
    if (!serviceCode || seen.has(serviceCode)) continue;
    seen.add(serviceCode);
    const name = block.procedureName?.trim() || serviceCode;
    if (fulfillment === "VISIT") {
      const visit = await findVisit(patientRefId, serviceCode, episodeId);
      items.push({
        slot: block.procedureCode,
        resolvedCode: serviceCode,
        kind: "visit",
        title: { en: name, ru: name, az: name },
        status: visit
          ? visit.status === "COMPLETED"
            ? "DONE"
            : "ORDERED"
          : "MISSING",
        href: visit ? `/visits/${visit.id}` : null,
        recordId: visit?.id ?? null,
        scheduledAt: visit?.scheduledAt?.toISOString() ?? null,
      });
      continue;
    }
    const order = await findLabOrder(patientRefId, serviceCode, {
      clinicalEpisodeId: episodeId,
    });
    items.push({
      slot: block.procedureCode,
      resolvedCode: serviceCode,
      kind: serviceCode === "USG-ABD" ? "imaging" : "lab",
      title: { en: name, ru: name, az: name },
      status: order ? labStatus(order.status) : "MISSING",
      href: order ? `/lab-orders?order=${order.id}` : null,
      recordId: order?.id ?? null,
      scheduledAt: null,
    });
  }

  return { packageCode: programCode, packageTitle: title, items };
}
