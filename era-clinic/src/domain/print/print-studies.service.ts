import { prisma } from "@/lib/prisma";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";
import { composePrintPatientStrip, loadPrintEpisodeStay } from "@/domain/print/print-patient-strip";
import { loadCatalogDisplayNameMap } from "@/domain/catalog/catalog-display-name.service";
import { bakuDateDisplay, bakuTimeLabel, todayBakuYmd } from "@/lib/baku-day";

export type PrintStudyRow = {
  name: string;
  when: string;
  status: string;
};

export type PrintStudiesDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  rows: PrintStudyRow[];
};

function titleFor(
  lang: PrintLang,
  service: { titleEn: string; titleRu: string; titleAz: string; code: string } | null,
  fallback: string,
): string {
  if (!service) return fallback;
  const picked =
    lang === "az" ? service.titleAz : lang === "ru" ? service.titleRu : service.titleEn;
  const title = picked.trim();
  return title && title !== service.code ? title : fallback;
}

export async function buildStudiesPrint(
  patientId: string,
  lang: PrintLang,
  episodeId?: string | null,
): Promise<PrintStudiesDocument | null> {
  const patient = await prisma.patientRef.findUnique({ where: { id: patientId } });
  if (!patient) return null;

  const branding = await getPrintBranding(lang);
  const episode = episodeId
    ? await prisma.clinicalEpisode.findFirst({
        where: { id: episodeId, patientRefId: patientId },
      })
    : await prisma.clinicalEpisode.findFirst({
        where: { patientRefId: patientId },
        orderBy: { openedAt: "desc" },
      });

  const episodeFilter = episode ? { clinicalEpisodeId: episode.id } : {};
  const [orders, visits] = await Promise.all([
    prisma.labOrder.findMany({
      where: { patientRefId: patientId, ...episodeFilter, cancelledAt: null },
      include: { items: { include: { diagnosticService: true } } },
      orderBy: [{ scheduledCollectionAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.visit.findMany({
      where: {
        patientRefId: patientId,
        ...episodeFilter,
        status: { not: "CANCELLED" },
        OR: [
          { serviceLines: { some: { inPackage: true } } },
          { serviceLines: { some: { packageQuotaCode: { not: null } } } },
          { settlementPendingId: { not: null } },
        ],
      },
      include: { serviceLines: true, appointment: { select: { scheduledAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const rows: PrintStudyRow[] = [];
  for (const order of orders) {
    const when = order.scheduledCollectionAt ?? order.createdAt;
    const stamp = `${bakuDateDisplay(when)} ${bakuTimeLabel(when)}`;
    const lines = order.items.length > 0 ? order.items : [null];
    for (const item of lines) {
      const catalogName = item
        ? titleFor(lang, item.diagnosticService, item.serviceCode)
        : order.testCode;
      rows.push({
        name: catalogName,
        when: stamp,
        status: order.status,
      });
    }
  }
  for (const visit of visits) {
    const when = visit.appointment?.scheduledAt ?? visit.createdAt;
    const stamp = `${bakuDateDisplay(when)} ${bakuTimeLabel(when)}`;
    const lines = visit.serviceLines.length > 0 ? visit.serviceLines : [null];
    for (const line of lines) {
      const written = line?.description?.trim() ?? "";
      rows.push({
        name: written && written !== line?.serviceCode ? written : line?.serviceCode || visit.id,
        when: stamp,
        status: visit.status,
      });
    }
  }

  const catalog = await loadCatalogDisplayNameMap(
    rows.map((row) => row.name),
    lang,
  );
  for (const row of rows) {
    const titled = catalog.get(row.name)?.trim();
    if (titled && titled !== row.name) row.name = titled;
  }

  const stay = await loadPrintEpisodeStay({
    episodeId: episode?.id ?? null,
    patientRefId: patientId,
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
    rows,
  };
}
