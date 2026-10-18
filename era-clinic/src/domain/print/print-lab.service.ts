import { prisma } from "@/lib/prisma";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";
import { composePrintPatientStrip, loadPrintEpisodeStay } from "@/domain/print/print-patient-strip";
import { formatNameAndCode } from "@/lib/display-code";
import { bakuDateKey } from "@/lib/baku-day";

export type PrintLabRow = {
  no: number;
  code: string;
  label: string;
  value: string;
  unit: string;
  norm: string;
  flag: string;
  section: string | null;
};

export type PrintLabDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  title: string;
  sections: { key: string; title: string; rows: PrintLabRow[] }[];
  signatureLab: string | null;
};

function formatNorm(refMin?: string | null, refMax?: string | null, unit?: string | null): string {
  const a = (refMin ?? "").trim();
  const b = (refMax ?? "").trim();
  let n = "";
  if (a && b) n = `${a}-${b}`;
  else if (a) n = a;
  else if (b) n = b;
  if (unit && n) return `${n} ${unit}`;
  return n || unit || "—";
}

export async function buildLabOrderPrint(orderId: string, lang: PrintLang): Promise<PrintLabDocument | null> {
  const order = await prisma.labOrder.findUnique({
    where: { id: orderId },
    include: {
      patientRef: true,
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          results: { orderBy: { code: "asc" } },
          diagnosticService: {
            include: {
              analytes: {
                orderBy: { sortOrder: "asc" },
                include: {
                  valueOptions: { orderBy: { sortOrder: "asc" } },
                  card: { select: { code: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!order) return null;

  const branding = await getPrintBranding(lang);
  const stay = await loadPrintEpisodeStay({
    episodeId: order.clinicalEpisodeId,
    patientRefId: order.patientRefId,
  });

  const patient: PrintPatientStrip = composePrintPatientStrip({
    fullName: order.patientRef?.fullName ?? "—",
    sex: order.patientRef?.sex,
    birthDate: order.patientRef?.birthDate,
    phone: order.patientRef?.phone,
    nationality: order.patientRef?.nationality,
    date: bakuDateKey(order.completedAt ?? order.publishedAt ?? order.resultDate ?? order.createdAt),
    stay,
  });

  const titleParts: string[] = [];
  const sectionMap = new Map<string, PrintLabRow[]>();
  let no = 1;

  for (const item of order.items) {
    const svc = item.diagnosticService;
    if (svc) {
      const name = pickL10n({ en: svc.titleEn, ru: svc.titleRu, az: svc.titleAz }, lang);
      titleParts.push(formatNameAndCode(name, svc.code || item.serviceCode));
    } else if (item.serviceCode) {
      titleParts.push(item.serviceCode);
    }
    const analytes = svc?.analytes ?? [];
    const savedFor = (analyte: { code: string; card?: { code: string } | null }) =>
      item.results.find(
        (row) => row.code === analyte.code || (analyte.card?.code && row.code === analyte.card.code),
      );
    const used = new Set(
      analytes.flatMap((analyte) => {
        const saved = savedFor(analyte);
        return saved ? [saved.code] : [];
      }),
    );
    const resultRows = [
      ...analytes.map((analyte) => ({ saved: savedFor(analyte), analyte })),
      ...item.results
        .filter((row) => !used.has(row.code))
        .map((saved) => ({ saved, analyte: undefined })),
    ];
    const seen = new Set<string>();
    for (const { saved, analyte } of resultRows) {
      const code = analyte?.code ?? saved?.code ?? "";
      if (!code || seen.has(code)) continue;
      seen.add(code);
      const section = analyte?.section ?? null;
      const sectionKey = section ?? "_default";
      let value = saved?.value ?? "";
      if (analyte?.valueType === "QUALITATIVE" && analyte.valueOptions?.length && value) {
        const opt = analyte.valueOptions.find((o: { code: string }) => o.code === value);
        if (opt) {
          value = pickL10n(
            { en: opt.labelEn, ru: opt.labelRu, az: opt.labelAz ?? opt.labelEn },
            lang,
          );
        }
      }
      const shown = String(value ?? "").trim();
      const catalogLabel = analyte
        ? pickL10n(
            {
              en: analyte.labelEn ?? code,
              ru: analyte.labelRu ?? analyte.labelEn ?? code,
              az: analyte.labelAz ?? analyte.labelEn ?? code,
            },
            lang,
          )
        : code;
      const label = saved?.label?.trim() || catalogLabel;
      const row: PrintLabRow = {
        no: no++,
        code,
        label,
        value: shown || "—",
        unit: saved?.unit ?? analyte?.unit ?? "",
        norm: formatNorm(saved?.refMin ?? analyte?.refMin, saved?.refMax ?? analyte?.refMax) || "—",
        flag: saved?.flag || "—",
        section,
      };
      const list = sectionMap.get(sectionKey) ?? [];
      list.push(row);
      sectionMap.set(sectionKey, list);
    }
  }

  const sections = [...sectionMap.entries()].map(([key, rows]) => ({
    key,
    title: key === "_default" ? "" : key,
    rows,
  }));

  return {
    branding,
    patient,
    title: titleParts.join(", ") || order.testCode || "Lab results",
    sections,
    signatureLab: branding.signatureLab,
  };
}
