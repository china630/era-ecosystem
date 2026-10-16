import { prisma } from "@/lib/prisma";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";
import { formatNameAndCode } from "@/lib/display-code";
import { bakuDateKey } from "@/lib/baku-day";

export type PrintUsmRow = {
  label: string;
  value: string;
  flag: string;
};

export type PrintUsmDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  title: string;
  rows: PrintUsmRow[];
  signatureDoctor: string | null;
};

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
  const rows: PrintUsmRow[] = [];

  type FieldDef = {
    key?: string;
    code?: string;
    label?: { en?: string; ru?: string; az?: string | null };
  };

  function fillMeasurements(text: string, measurements: Record<string, string>, consumed: Set<string>): string {
    return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
      consumed.add(key);
      return measurements[key] ?? "";
    });
  }

  for (const item of order.items) {
    const measurements: Record<string, string> = {};
    const consumed = new Set<string>();
    for (const result of item.results) {
      if (result.code.startsWith("meas.")) measurements[result.code.slice("meas.".length)] = result.value;
    }
    let fields: FieldDef[] = [];
    const rawFields = item.diagnosticService?.fieldsJson;
    if (rawFields) {
      try {
        const parsed: unknown = JSON.parse(rawFields);
        if (Array.isArray(parsed)) fields = parsed as FieldDef[];
      } catch {
        fields = [];
      }
    }
    const used = new Set<string>();
    for (const field of fields) {
      const key = field.key || field.code;
      if (!key) continue;
      used.add(key);
      const saved = item.results.find((row) => row.code === key);
      const label = field.label
        ? pickL10n(
            {
              en: field.label.en ?? key,
              ru: field.label.ru ?? field.label.en ?? key,
              az: field.label.az ?? field.label.en ?? key,
            },
            lang,
          )
        : key;
      const raw = saved?.value?.trim() || "";
      const value = raw ? fillMeasurements(raw, measurements, consumed) : "—";
      rows.push({
        label,
        value,
        flag: value === "—" ? "—" : saved?.flag?.trim() || "NORMAL",
      });
    }
    for (const result of item.results) {
      if (used.has(result.code) || result.code.startsWith("meas.")) continue;
      let label = result.label?.trim() || result.code.replace(/^(meta|phrase)\./, "");
      let value = result.value?.trim() || "—";
      if (result.code.startsWith("phrase.")) {
        const phrase = phraseByCode.get(result.value);
        if (phrase) {
          value = fillMeasurements(
            pickL10n({ en: phrase.textEn, ru: phrase.textRu, az: phrase.textAz }, lang),
            measurements,
            consumed,
          );
        }
      } else if (value !== "—") {
        value = fillMeasurements(value, measurements, consumed);
      }
      rows.push({
        label,
        value,
        flag: value === "—" ? "—" : result.flag?.trim() || "NORMAL",
      });
    }
    for (const [key, raw] of Object.entries(measurements)) {
      if (consumed.has(key)) continue;
      const value = raw.trim() || "—";
      rows.push({ label: key, value, flag: value === "—" ? "—" : "NORMAL" });
    }
  }

  const title =
    order.items
      .map((i: {
        serviceCode: string;
        diagnosticService: { titleEn: string; titleRu: string; titleAz: string | null } | null;
      }) => {
        const name = i.diagnosticService
          ? pickL10n(
              {
                en: i.diagnosticService.titleEn,
                ru: i.diagnosticService.titleRu,
                az: i.diagnosticService.titleAz ?? i.diagnosticService.titleEn,
              },
              lang,
            )
          : "";
        return formatNameAndCode(name, i.serviceCode);
      })
      .filter(Boolean)
      .join(", ") || formatNameAndCode("", order.testCode) || "USM";

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
      date: bakuDateKey(order.completedAt ?? order.publishedAt ?? order.createdAt),
    },
    title,
    rows,
    signatureDoctor: branding.signatureDoctor,
  };
}
