import { prisma } from "@/lib/prisma";
import { getClinicSettings } from "@/domain/settings/settings.service";
import {
  printsProcedureClock,
  showsUnpaidExtraOnPlan,
} from "@/domain/sanatorium/extra-procedure-route";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";
import {
  composePrintPatientStrip,
  loadPrintEpisodeStay,
} from "@/domain/print/print-patient-strip";
import { formatIcdLabel, normalizeIcdLocale } from "@/domain/icd/icd-catalog";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import {
  loadCatalogDisplayNameMap,
  resolveOrderDisplayName,
} from "@/domain/catalog/catalog-display-name.service";
import { PRINT_PROCEDURE_STATUSES } from "@/domain/print/print-procedures.service";
import { parseCpoePayload, pickPayloadTitle } from "@/domain/cpoe/cpoe-payload";
import { todayBakuYmd } from "@/lib/baku-day";

export type PrintEpisodeLine = {
  when: string;
  title: string;
  detail: string;
};

export type PrintEpisodeSummaryDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  courseOpen: boolean;
  programCode: string | null;
  origin: string | null;
  anamnesis: string | null;
  complaints: PrintEpisodeLine[];
  diagnoses: PrintEpisodeLine[];
  labs: PrintEpisodeLine[];
  exams: PrintEpisodeLine[];
  procedures: PrintEpisodeLine[];
};

function bakuStamp(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("en-GB", {
    timeZone: "Asia/Baku",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function bakuDay(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Baku" });
}

function labReadyAt(order: {
  completedAt: Date | null;
  publishedAt: Date | null;
  resultDate: Date | null;
  collectedAt: Date | null;
  createdAt: Date;
}): Date {
  return (
    order.completedAt ??
    order.publishedAt ??
    order.resultDate ??
    order.collectedAt ??
    order.createdAt
  );
}

export async function buildEpisodeSummaryPrint(
  patientId: string,
  lang: PrintLang,
  episodeId?: string | null,
): Promise<PrintEpisodeSummaryDocument | null> {
  const patient = await prisma.patientRef.findUnique({ where: { id: patientId } });
  if (!patient) return null;

  const episodeWhere = episodeId
    ? { id: episodeId, patientRefId: patientId }
    : { patientRefId: patientId };
  const episode = await prisma.clinicalEpisode.findFirst({
    where: episodeWhere,
    orderBy: { openedAt: "desc" },
    include: {
      complaints: { orderBy: { recordedAt: "asc" } },
      diagnoses: { include: { icdCode: true }, orderBy: { recordedAt: "asc" } },
      programInstance: { select: { programCode: true } },
    },
  });
  if (!episode) return null;

  const [branding, clinicSettings] = await Promise.all([
    getPrintBranding(lang),
    getClinicSettings(),
  ]);
  const stay = await loadPrintEpisodeStay({
    episodeId: episode.id,
    patientRefId: patientId,
  });

  const [labOrders, procedureOrders, examNotes] = await Promise.all([
    prisma.labOrder.findMany({
      where: {
        OR: [
          { clinicalEpisodeId: episode.id },
          { visit: { clinicalEpisodeId: episode.id } },
        ],
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            diagnosticService: {
              select: { code: true, titleEn: true, titleRu: true, titleAz: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.procedureOrder.findMany({
      where: {
        patientRefId: patientId,
        clinicalEpisodeId: episode.id,
        ...(showsUnpaidExtraOnPlan(clinicSettings.extraProcedureRoute)
          ? {
              OR: [
                { status: { in: [...PRINT_PROCEDURE_STATUSES] } },
                { status: "PENDING_PAY" as const, inPackage: false },
              ],
            }
          : { status: { in: [...PRINT_PROCEDURE_STATUSES] } }),
      },
      include: {
        resource: { include: { room: true } },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    prisma.cpoeEntry.findMany({
      where: { visit: { clinicalEpisodeId: episode.id } },
      include: {
        visit: { select: { practitioner: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const catalogNames = await loadCatalogDisplayNameMap(
    procedureOrders.map((row) => row.procedureCode),
    lang,
  );

  const complaints = episode.complaints.map((row) => ({
    when: bakuDay(row.recordedAt),
    title: row.text.trim() || "—",
    detail: "",
  }));

  const diagnoses = episode.diagnoses.map((row) => {
    const base = formatIcdLabel(row.icdCode, normalizeIcdLocale(lang));
    return {
      when: bakuDay(row.recordedAt),
      title: row.note ? `${base} (${row.note})` : base,
      detail: "",
    };
  });

  const labs = labOrders.flatMap((order) => {
    const rows = order.items.length ? order.items : [null];
    return rows.map((item) => {
      const svc = item?.diagnosticService;
      const name = svc
        ? pickL10n({ en: svc.titleEn, ru: svc.titleRu, az: svc.titleAz }, lang)
        : "";
      const code = item?.serviceCode || order.testCode;
      return {
        when: bakuStamp(labReadyAt(order)),
        title: name ? `${name} (${code})` : code,
        detail: printLabel(lang, `labStatus_${order.status}`),
      };
    });
  });

  const exams = examNotes.map((note) => {
    const payload = parseCpoePayload(note.payloadJson);
    const title = pickPayloadTitle(payload, lang, note.templateId ?? printLabel(lang, "visitExam"));
    const doctor = note.visit.practitioner?.fullName?.trim() ?? "";
    return {
      when: bakuStamp(note.createdAt),
      title,
      detail: doctor,
    };
  });

  const procedures = procedureOrders.map((order) => {
    const seated = printsProcedureClock(order.status, order.resourceId);
    const room = seated
      ? (order.resource?.room?.name ?? order.resource?.name ?? order.resource?.code ?? "")
      : "";
    return {
      when: seated ? bakuStamp(order.scheduledAt) : "",
      title: resolveOrderDisplayName(order, catalogNames),
      detail: [
        order.status === "PENDING_PAY" ? printLabel(lang, "unpaidExtra") : printLabel(lang, `procStatus_${order.status}`),
        seated ? room : "",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });

  return {
    branding,
    patient: composePrintPatientStrip({
      fullName: patient.fullName,
      sex: patient.sex,
      birthDate: patient.birthDate,
      phone: patient.phone,
      nationality: patient.nationality,
      date: todayBakuYmd(),
      stay,
    }),
    courseOpen: episode.status === "OPEN",
    programCode: episode.programCode ?? episode.programInstance?.programCode ?? null,
    origin: episode.patientOrigin,
    anamnesis: episode.anamnesisText?.trim() || null,
    complaints,
    diagnoses,
    labs,
    exams,
    procedures,
  };
}
