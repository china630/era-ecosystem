import { prisma } from "@/lib/prisma";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";

export type PrintUsmDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  title: string;
  narrative: string;
  signatureDoctor: string | null;
};

function applyMeasurements(text: string, measurements: Record<string, string>): string {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => measurements[key] ?? "");
}

export async function buildUsmPrint(orderId: string, lang: PrintLang): Promise<PrintUsmDocument | null> {
  const order = await prisma.labOrder.findUnique({
    where: { id: orderId },
    include: {
      patientRef: true,
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          results: true,
          diagnosticService: true,
        },
      },
    },
  });
  if (!order) return null;

  const branding = await getPrintBranding(lang);
  const episode = await prisma.clinicalEpisode.findFirst({
    where: { patientRefId: order.patientRefId },
    orderBy: { openedAt: "desc" },
  });

  const phrases = await prisma.imagingPhrase.findMany({ where: { active: true } });
  const phraseByCode = new Map(phrases.map((p) => [p.code, p]));

  const measurements: Record<string, string> = {};
  const phraseCodes: { organ: string; code: string }[] = [];
  const freeText: string[] = [];

  for (const item of order.items) {
    for (const r of item.results) {
      if (r.code.startsWith("meas.")) {
        measurements[r.code.slice(5)] = r.value;
      } else if (r.code.startsWith("phrase.")) {
        phraseCodes.push({ organ: r.code.slice(7), code: r.value });
      } else if (!r.code.startsWith("meta.")) {
        freeText.push(r.value);
      }
    }
  }

  const narrativeParts: string[] = [];
  for (const { organ, code } of phraseCodes) {
    const phrase = phraseByCode.get(code);
    if (phrase) {
      const text = pickL10n({ en: phrase.textEn, ru: phrase.textRu, az: phrase.textAz }, lang);
      narrativeParts.push(`${organ}: ${applyMeasurements(text, measurements)}`);
    } else {
      narrativeParts.push(`${organ}: ${code}`);
    }
  }
  if (narrativeParts.length === 0 && freeText.length) {
    narrativeParts.push(...freeText);
  }

  const title =
    order.items
      .map((i: {
        serviceCode: string;
        diagnosticService: { titleEn: string; titleRu: string; titleAz: string | null } | null;
      }) =>
        i.diagnosticService
          ? pickL10n(
              {
                en: i.diagnosticService.titleEn,
                ru: i.diagnosticService.titleRu,
                az: i.diagnosticService.titleAz ?? i.diagnosticService.titleEn,
              },
              lang,
            )
          : i.serviceCode,
      )
      .filter(Boolean)
      .join(", ") || "USM";

  return {
    branding,
    patient: {
      fullName: order.patientRef?.fullName ?? "—",
      sex: order.patientRef?.sex ?? null,
      birthDate: order.patientRef?.birthDate
        ? order.patientRef.birthDate.toISOString().slice(0, 10)
        : null,
      phone: order.patientRef?.phone ?? null,
      nationality: order.patientRef?.nationality ?? null,
      roomNumber: episode?.roomNumber ?? null,
      doctorName: branding.signatureDoctor,
      date: (order.completedAt ?? order.publishedAt ?? order.createdAt).toISOString().slice(0, 10),
    },
    title,
    narrative: narrativeParts.join("\n\n"),
    signatureDoctor: branding.signatureDoctor,
  };
}
