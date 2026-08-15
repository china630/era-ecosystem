/**
 * Print loaders + UI shell + language dialog
 */
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
function write(rel, content) {
  const full = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content.replace(/\r\n/g, "\n"), "utf8");
  console.log("wrote", rel);
}

write(
  "src/domain/print/print-lab.service.ts",
  `import { prisma } from "@/lib/prisma";
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
  if (a && b) n = \`\${a}-\${b}\`;
  else if (a) n = a;
  else if (b) n = b;
  if (unit && n) return \`\${n} \${unit}\`;
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
    where: { patientRefId: order.patientRefId, status: { in: ["ACTIVE", "OPEN", "CHECKED_IN"] } },
    orderBy: { createdAt: "desc" },
  }).catch(() => null);

  const patient: PrintPatientStrip = {
    fullName: order.patientRef?.fullName ?? "—",
    sex: order.patientRef?.sex ?? null,
    birthDate: order.patientRef?.dateOfBirth
      ? order.patientRef.dateOfBirth.toISOString().slice(0, 10)
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
    title: titleParts.join(", ") || order.testsCsv || "Lab results",
    sections,
    signatureLab: branding.signatureLab,
  };
}
`,
);

write(
  "src/domain/print/print-usm.service.ts",
  `import { prisma } from "@/lib/prisma";
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
  return text.replace(/\\{\\{\\s*([a-zA-Z0-9_]+)\\s*\\}\\}/g, (_, key: string) => measurements[key] ?? "");
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
    orderBy: { createdAt: "desc" },
  }).catch(() => null);

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
      narrativeParts.push(\`\${organ}: \${applyMeasurements(text, measurements)}\`);
    } else {
      narrativeParts.push(\`\${organ}: \${code}\`);
    }
  }
  if (narrativeParts.length === 0 && freeText.length) {
    narrativeParts.push(...freeText);
  }

  const title =
    order.items
      .map((i) =>
        i.diagnosticService
          ? pickL10n(
              {
                en: i.diagnosticService.titleEn,
                ru: i.diagnosticService.titleRu,
                az: i.diagnosticService.titleAz,
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
      birthDate: order.patientRef?.dateOfBirth
        ? order.patientRef.dateOfBirth.toISOString().slice(0, 10)
        : null,
      phone: order.patientRef?.phone ?? null,
      nationality: order.patientRef?.nationality ?? null,
      roomNumber: episode?.roomNumber ?? null,
      doctorName: branding.signatureDoctor,
      date: (order.completedAt ?? order.publishedAt ?? order.createdAt).toISOString().slice(0, 10),
    },
    title,
    narrative: narrativeParts.join("\\n\\n"),
    signatureDoctor: branding.signatureDoctor,
  };
}
`,
);

write(
  "src/domain/print/print-checkup.service.ts",
  `import { prisma } from "@/lib/prisma";
import { getCheckupSectionsConfig, getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";

export type PrintCheckupSection = {
  specialty: string;
  title: string;
  enabled: boolean;
  doctorName: string | null;
  scheduleHint: string | null;
};

export type PrintCheckupDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  arrival: string | null;
  departure: string | null;
  sections: PrintCheckupSection[];
};

function specialtyAliases(specialty: string): string[] {
  const s = specialty.toLowerCase();
  const map: Record<string, string[]> = {
    therapist: ["therapist", "terapevt", "gp", "general"],
    cardiologist: ["cardio", "kardioloq", "cardiologist"],
    gynecologist: ["gyne", "gine", "ginekoloq"],
    usm: ["usm", "usg", "ultrasound", "radiolog"],
    dermatoneurologist: ["dermato", "dermatonevro"],
    cosmetologist: ["cosmo", "kosmeto"],
    manual_therapist: ["manual", "manu"],
  };
  return map[s] ?? [s];
}

function matchesSpecialty(practitionerSpecialty: string | null | undefined, key: string): boolean {
  if (!practitionerSpecialty) return false;
  const hay = practitionerSpecialty.toLowerCase();
  return specialtyAliases(key).some((a) => hay.includes(a));
}

export async function buildCheckupPrint(
  patientId: string,
  lang: PrintLang,
): Promise<PrintCheckupDocument | null> {
  const patient = await prisma.patientRef.findUnique({ where: { id: patientId } });
  if (!patient) return null;

  const branding = await getPrintBranding(lang);
  const config = await getCheckupSectionsConfig();
  const episode = await prisma.clinicalEpisode.findFirst({
    where: { patientRefId: patientId },
    orderBy: { createdAt: "desc" },
  });

  const appointments = await prisma.appointment.findMany({
    where: { patientRefId: patientId },
    include: { practitioner: true },
    orderBy: { scheduledAt: "asc" },
  });

  const sections = config.map((cfg) => {
    const apt = appointments.find((a) => matchesSpecialty(a.practitioner.specialty, cfg.specialty));
    return {
      specialty: cfg.specialty,
      title: printLabel(lang, \`specialty_\${cfg.specialty}\`),
      enabled: cfg.enabled,
      doctorName: apt?.practitioner.fullName ?? null,
      scheduleHint: apt
        ? apt.scheduledAt.toLocaleString("en-GB", { timeZone: "Asia/Baku", hour: "2-digit", minute: "2-digit" })
        : null,
    };
  });

  return {
    branding,
    patient: {
      fullName: patient.fullName,
      sex: patient.sex,
      birthDate: patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : null,
      phone: patient.phone,
      nationality: patient.nationality,
      roomNumber: episode?.roomNumber ?? null,
      doctorName: null,
      date: new Date().toISOString().slice(0, 10),
    },
    arrival: episode?.checkInAt ? episode.checkInAt.toISOString().slice(0, 10) : null,
    departure: episode?.checkOutAt ? episode.checkOutAt.toISOString().slice(0, 10) : null,
    sections,
  };
}
`,
);

write(
  "src/domain/print/print-procedures.service.ts",
  `import { prisma } from "@/lib/prisma";
import { getPrintBranding } from "@/domain/print/print-branding.service";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";

export type PrintProcedureRow = {
  no: number;
  date: string;
  name: string;
  quantity: number;
  time: string;
  room: string;
  doctor: string;
  price: string;
  note: string;
};

export type PrintProceduresDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  rowsByDate: { date: string; rows: PrintProcedureRow[] }[];
};

function bakuDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { timeZone: "Asia/Baku" });
}

function bakuTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Baku",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export async function buildProceduresPrint(
  patientId: string,
  lang: PrintLang,
): Promise<PrintProceduresDocument | null> {
  const patient = await prisma.patientRef.findUnique({ where: { id: patientId } });
  if (!patient) return null;

  const branding = await getPrintBranding(lang);
  const episode = await prisma.clinicalEpisode.findFirst({
    where: { patientRefId: patientId },
    orderBy: { createdAt: "desc" },
  });

  const orders = await prisma.procedureOrder.findMany({
    where: {
      patientRefId: patientId,
      status: { notIn: ["CANCELLED"] },
    },
    include: {
      resource: { include: { room: true } },
      allocations: { include: { practitioner: true } },
      resourceBooking: { include: { practitioner: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  let no = 1;
  const map = new Map<string, PrintProcedureRow[]>();
  for (const o of orders) {
    const date = bakuDate(o.scheduledAt);
    const staff = o.allocations.find((a) => a.practitioner)?.practitioner;
    const bookingDoc = o.resourceBooking?.practitioner;
    const doctor = staff?.fullName ?? bookingDoc?.fullName ?? "—";
    const room =
      o.resource?.room?.name ??
      o.resource?.name ??
      o.resource?.code ??
      "—";
    const ends = o.endsAt ? \`-\${bakuTime(o.endsAt)}\` : "";
    const row: PrintProcedureRow = {
      no: no++,
      date,
      name: o.procedureName,
      quantity: o.quantity ?? 1,
      time: \`\${bakuTime(o.scheduledAt)}\${ends}\`,
      room,
      doctor,
      price: \`\${Number(o.amountNet).toFixed(2)} AZN\`,
      note: o.note ?? "",
    };
    const list = map.get(date) ?? [];
    list.push(row);
    map.set(date, list);
  }

  return {
    branding,
    patient: {
      fullName: patient.fullName,
      sex: patient.sex,
      birthDate: patient.dateOfBirth ? patient.dateOfBirth.toISOString().slice(0, 10) : null,
      phone: patient.phone,
      nationality: patient.nationality,
      roomNumber: episode?.roomNumber ?? null,
      doctorName: null,
      date: new Date().toISOString().slice(0, 10),
    },
    rowsByDate: [...map.entries()].map(([date, rows]) => ({ date, rows })),
  };
}
`,
);

console.log("loaders done");
