import { prisma } from "@/lib/prisma";
import {
  pickL10n,
  type CatalogFieldDef,
  type L10n,
} from "@/domain/catalog/diagnostic-catalog-shared";
import {
  parseCpoePayload,
  pickPayloadTitle,
  resolvePrintedValue,
  type CpoeFieldDefSnap,
  type CpoeValueOptionSnap,
} from "@/domain/cpoe/cpoe-payload";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";
import { bakuDateKey } from "@/lib/baku-day";

export type VisitExamPrintRow = {
  label: string;
  value: string;
  unit?: string;
  ref?: string;
};

export type PrintVisitExamDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  title: string;
  diagnoses: string[];
  rows: VisitExamPrintRow[];
  signatureDoctor: string | null;
};

function parseFieldsJson(raw: string | null | undefined): CatalogFieldDef[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as CatalogFieldDef[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function fieldLabel(
  snap: CpoeFieldDefSnap | undefined,
  live: CatalogFieldDef | undefined,
  key: string,
  lang: PrintLang,
): string {
  if (snap?.label) return pickL10n(snap.label, lang) || key;
  if (live?.label) return pickL10n(live.label, lang) || key;
  return key;
}

function lineLabel(
  label: L10n | string | undefined,
  code: string,
  lang: PrintLang,
): string {
  if (!label) return code;
  if (typeof label === "string") return label || code;
  return pickL10n(label, lang) || code;
}

function refRange(refMin?: string, refMax?: string): string | undefined {
  const a = (refMin ?? "").trim();
  const b = (refMax ?? "").trim();
  if (!a && !b) return undefined;
  if (a && b) return `${a}–${b}`;
  return a || b;
}

function optionsFromField(
  snap: CpoeFieldDefSnap | undefined,
  live: CatalogFieldDef | undefined,
): CpoeValueOptionSnap[] | undefined {
  if (snap?.options?.length) return snap.options;
  if (!live?.options?.length) return undefined;
  return live.options.map((opt) => ({
    code: opt,
    label: { en: opt, ru: opt, az: opt },
  }));
}

export async function buildVisitExamPrint(
  cpoeEntryId: string,
  lang: PrintLang,
): Promise<PrintVisitExamDocument | null> {
  const entry = await prisma.cpoeEntry.findUnique({
    where: { id: cpoeEntryId },
    include: {
      visit: {
        include: {
          patientRef: true,
          practitioner: true,
          diagnoses: {
            include: { icdCode: true },
            orderBy: [{ role: "asc" }, { recordedAt: "asc" }],
          },
        },
      },
    },
  });
  if (!entry?.visit) return null;

  const payload = parseCpoePayload(entry.payloadJson);
  const templateCode = entry.templateId ?? payload.templateCode ?? null;

  const service = templateCode
    ? await prisma.diagnosticService.findFirst({
        where: {
          organizationId: entry.visit.organizationId,
          code: templateCode,
        },
        include: {
          analytes: {
            include: { valueOptions: { orderBy: { sortOrder: "asc" } } },
          },
        },
      })
    : null;

  const liveFields = parseFieldsJson(service?.fieldsJson ?? null);
  const liveFieldByKey = new Map(liveFields.map((f) => [f.key, f]));
  const snapFieldByKey = new Map((payload.fieldDefs ?? []).map((f) => [f.key, f]));

  const analyteOptByCode = new Map<string, CpoeValueOptionSnap[]>();
  for (const a of service?.analytes ?? []) {
    if (a.valueType === "QUALITATIVE" && a.valueOptions.length) {
      analyteOptByCode.set(
        a.code,
        a.valueOptions.map((o) => ({
          code: o.code,
          label: {
            en: o.labelEn,
            ru: o.labelRu,
            az: o.labelAz ?? o.labelEn,
          },
        })),
      );
    }
  }

  const rows: VisitExamPrintRow[] = [];

  for (const [key, value] of Object.entries(payload.meta ?? {})) {
    if (!String(value ?? "").trim()) continue;
    rows.push({ label: key, value: String(value) });
  }

  const fieldKeys =
    (payload.fieldDefs?.length ?? 0) > 0
      ? payload.fieldDefs!.map((f) => f.key)
      : Object.keys(payload.fields ?? {});

  const seenFields = new Set<string>();
  for (const key of fieldKeys) {
    seenFields.add(key);
    const value = payload.fields?.[key];
    if (!String(value ?? "").trim()) continue;
    const snap = snapFieldByKey.get(key);
    const live = liveFieldByKey.get(key);
    rows.push({
      label: fieldLabel(snap, live, key, lang),
      value: resolvePrintedValue(String(value), optionsFromField(snap, live), lang),
      unit: snap?.unit ?? live?.unit,
    });
  }
  for (const [key, value] of Object.entries(payload.fields ?? {})) {
    if (seenFields.has(key)) continue;
    if (!String(value ?? "").trim()) continue;
    const live = liveFieldByKey.get(key);
    rows.push({
      label: fieldLabel(undefined, live, key, lang),
      value: resolvePrintedValue(String(value), optionsFromField(undefined, live), lang),
      unit: live?.unit,
    });
  }

  for (const line of payload.lines ?? []) {
    if (!String(line.value ?? "").trim()) continue;
    const opts =
      line.valueOptions?.length
        ? line.valueOptions
        : analyteOptByCode.get(line.code);
    rows.push({
      label: lineLabel(line.label, line.code, lang),
      value: resolvePrintedValue(String(line.value), opts, lang),
      unit: line.unit,
      ref: refRange(line.refMin, line.refMax),
    });
  }

  const branding = await getPrintBranding(lang);
  const doctorName = entry.visit.practitioner?.fullName ?? null;
  const titleFallback =
    service != null
      ? pickL10n(
          {
            en: service.titleEn,
            ru: service.titleRu,
            az: service.titleAz ?? service.titleEn,
          },
          lang,
        )
      : printLabel(lang, "visitExam");

  const diagnoses = entry.visit.diagnoses.map((d) => {
    const title =
      lang === "ru"
        ? d.icdCode.titleRu
        : lang === "az"
          ? d.icdCode.titleAz?.trim() || d.icdCode.titleRu
          : d.icdCode.titleEn;
    const base = `${d.icdCode.code} — ${title}`;
    const role = d.role === "PRIMARY" ? "" : ` [${d.role}]`;
    return d.note ? `${base}${role} (${d.note})` : `${base}${role}`;
  });

  return {
    branding,
    patient: {
      fullName: entry.visit.patientRef?.fullName ?? "—",
      sex: entry.visit.patientRef?.sex ?? null,
      birthDate: entry.visit.patientRef?.birthDate
        ? bakuDateKey(entry.visit.patientRef.birthDate)
        : null,
      phone: entry.visit.patientRef?.phone ?? null,
      nationality: entry.visit.patientRef?.nationality ?? null,
      roomNumber: entry.visit.roomNumber ?? null,
      doctorName,
      date: bakuDateKey(entry.createdAt),
    },
    title: pickPayloadTitle(payload, lang, titleFallback),
    diagnoses,
    rows,
    signatureDoctor: doctorName ?? branding.signatureDoctor,
  };
}
