import { prisma } from "@/lib/prisma";
import { pickL10n } from "@/domain/catalog/diagnostic-catalog-shared";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";

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
                include: { valueOptions: { orderBy: { sortOrder: "asc" } } },
              },
            },
          },
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

  const patient: PrintPatientStrip = {
    fullName: order.patientRef?.fullName ?? "—",
    sex: order.patientRef?.sex ?? null,
    birthDate: order.patientRef?.birthDate
      ? order.patientRef.birthDate.toISOString().slice(0, 10)
      : null,
    phone: order.patientRef?.phone ?? null,
    nationality: order.patientRef?.nationality ?? null,
    roomNumber: episode?.roomNumber ?? null,
    doctorName: null,
    date: (order.completedAt ?? order.publishedAt ?? order.createdAt).toISOString().slice(0, 10),
  };

  const titleParts: string[] = [];
  const sectionMap = new Map<string, PrintLabRow[]>();
  let no = 1;

  for (const item of order.items) {
    const svc = item.diagnosticService;
    if (svc) {
      titleParts.push(pickL10n({ en: svc.titleEn, ru: svc.titleRu, az: svc.titleAz }, lang));
    }
    const analytes = svc?.analytes ?? [];
    const byCode = new Map(analytes.map((a) => [a.code, a]));
    for (const r of item.results) {
      const analyte = byCode.get(r.code);
      const section = analyte?.section ?? null;
      const sectionKey = section ?? "_default";
      let value = r.value;
      if (analyte?.valueType === "QUALITATIVE" && analyte.valueOptions.length) {
        const opt = analyte.valueOptions.find((o) => o.code === r.value);
        if (opt) value = pickL10n({ en: opt.labelEn, ru: opt.labelRu, az: opt.labelAz }, lang);
      }
      const label = analyte
        ? pickL10n({ en: analyte.labelEn, ru: analyte.labelRu, az: analyte.labelAz }, lang)
        : r.label || r.code;
      const row: PrintLabRow = {
        no: no++,
        code: r.code,
        label,
        value,
        unit: r.unit ?? analyte?.unit ?? "",
        norm: formatNorm(r.refMin ?? analyte?.refMin, r.refMax ?? analyte?.refMax, r.unit ?? analyte?.unit),
        flag: r.flag,
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
