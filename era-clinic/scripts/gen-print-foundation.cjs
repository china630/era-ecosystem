/**
 * Generates core print-forms source files (UTF-8).
 * Run: node era-clinic/scripts/gen-print-foundation.cjs
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

const DEFAULT_CHECKUP = JSON.stringify([
  { specialty: "therapist", enabled: true },
  { specialty: "cardiologist", enabled: true },
  { specialty: "gynecologist", enabled: true },
  { specialty: "usm", enabled: true },
  { specialty: "dermatoneurologist", enabled: true },
  { specialty: "cosmetologist", enabled: false },
  { specialty: "manual_therapist", enabled: true },
]);

write(
  "src/domain/print/print-types.ts",
  `export type PrintLang = "en" | "ru" | "az";

export function normalizePrintLang(raw: string | null | undefined): PrintLang {
  const v = (raw ?? "en").toLowerCase();
  if (v.startsWith("ru")) return "ru";
  if (v.startsWith("az")) return "az";
  return "en";
}

export type PrintBranding = {
  logoDataUrl: string | null;
  clinicName: string;
  address: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  footer: string | null;
  signatureLab: string | null;
  signatureDoctor: string | null;
};

export type PrintPatientStrip = {
  fullName: string;
  sex: string | null;
  birthDate: string | null;
  phone: string | null;
  nationality: string | null;
  roomNumber: string | null;
  doctorName: string | null;
  date: string;
};

export type CheckupSectionConfig = {
  specialty: string;
  enabled: boolean;
};

export const DEFAULT_CHECKUP_SECTIONS: CheckupSectionConfig[] = ${DEFAULT_CHECKUP};
`,
);

write(
  "src/domain/print/print-branding.service.ts",
  `import { prisma } from "@/lib/prisma";
import { getDefaultTenant } from "@/domain/settings/settings.service";
import {
  DEFAULT_CHECKUP_SECTIONS,
  type CheckupSectionConfig,
  type PrintBranding,
  type PrintLang,
} from "@/domain/print/print-types";

function pick(lang: PrintLang, en: string | null, ru: string | null, az: string | null, fallback: string): string {
  if (lang === "ru") return (ru || en || az || fallback).trim() || fallback;
  if (lang === "az") return (az || en || ru || fallback).trim() || fallback;
  return (en || az || ru || fallback).trim() || fallback;
}

export async function getPrintBranding(lang: PrintLang): Promise<PrintBranding> {
  const tenant = await getDefaultTenant();
  return {
    logoDataUrl: tenant.printLogoDataUrl ?? null,
    clinicName: pick(
      lang,
      tenant.printClinicNameEn,
      tenant.printClinicNameRu,
      tenant.printClinicNameAz,
      tenant.name,
    ),
    address: pick(
      lang,
      tenant.printAddressEn,
      tenant.printAddressRu,
      tenant.printAddressAz,
      "",
    ),
    phone: tenant.printPhone ?? null,
    email: tenant.printEmail ?? null,
    website: tenant.printWebsite ?? null,
    footer: pick(
      lang,
      tenant.printFooterEn,
      tenant.printFooterRu,
      tenant.printFooterAz,
      "",
    ) || null,
    signatureLab: tenant.printSignatureLab ?? null,
    signatureDoctor: tenant.printSignatureDoctor ?? null,
  };
}

export async function getCheckupSectionsConfig(): Promise<CheckupSectionConfig[]> {
  const tenant = await getDefaultTenant();
  if (!tenant.checkupSectionsJson) return DEFAULT_CHECKUP_SECTIONS;
  try {
    const parsed = JSON.parse(tenant.checkupSectionsJson) as CheckupSectionConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_CHECKUP_SECTIONS;
    return parsed;
  } catch {
    return DEFAULT_CHECKUP_SECTIONS;
  }
}

export type PrintSettingsPatch = {
  printLogoDataUrl?: string | null;
  printClinicNameEn?: string | null;
  printClinicNameRu?: string | null;
  printClinicNameAz?: string | null;
  printAddressEn?: string | null;
  printAddressRu?: string | null;
  printAddressAz?: string | null;
  printPhone?: string | null;
  printEmail?: string | null;
  printWebsite?: string | null;
  printFooterEn?: string | null;
  printFooterRu?: string | null;
  printFooterAz?: string | null;
  printSignatureLab?: string | null;
  printSignatureDoctor?: string | null;
  checkupSectionsJson?: string | null;
};

export async function updatePrintSettings(input: PrintSettingsPatch) {
  const tenant = await getDefaultTenant();
  return prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      ...(input.printLogoDataUrl !== undefined ? { printLogoDataUrl: input.printLogoDataUrl } : {}),
      ...(input.printClinicNameEn !== undefined ? { printClinicNameEn: input.printClinicNameEn } : {}),
      ...(input.printClinicNameRu !== undefined ? { printClinicNameRu: input.printClinicNameRu } : {}),
      ...(input.printClinicNameAz !== undefined ? { printClinicNameAz: input.printClinicNameAz } : {}),
      ...(input.printAddressEn !== undefined ? { printAddressEn: input.printAddressEn } : {}),
      ...(input.printAddressRu !== undefined ? { printAddressRu: input.printAddressRu } : {}),
      ...(input.printAddressAz !== undefined ? { printAddressAz: input.printAddressAz } : {}),
      ...(input.printPhone !== undefined ? { printPhone: input.printPhone } : {}),
      ...(input.printEmail !== undefined ? { printEmail: input.printEmail } : {}),
      ...(input.printWebsite !== undefined ? { printWebsite: input.printWebsite } : {}),
      ...(input.printFooterEn !== undefined ? { printFooterEn: input.printFooterEn } : {}),
      ...(input.printFooterRu !== undefined ? { printFooterRu: input.printFooterRu } : {}),
      ...(input.printFooterAz !== undefined ? { printFooterAz: input.printFooterAz } : {}),
      ...(input.printSignatureLab !== undefined ? { printSignatureLab: input.printSignatureLab } : {}),
      ...(input.printSignatureDoctor !== undefined
        ? { printSignatureDoctor: input.printSignatureDoctor }
        : {}),
      ...(input.checkupSectionsJson !== undefined
        ? { checkupSectionsJson: input.checkupSectionsJson }
        : {}),
    },
  });
}
`,
);

write(
  "src/domain/print/print-labels.ts",
  `import type { PrintLang } from "@/domain/print/print-types";

type Dict = Record<string, string>;

const EN: Dict = {
  parameter: "Parameter",
  result: "Result",
  norm: "Reference",
  unit: "Unit",
  no: "No",
  patient: "Patient",
  sex: "Sex",
  birthDate: "Date of birth",
  phone: "Phone",
  country: "Country",
  roomNo: "Room No",
  doctor: "Doctor",
  date: "Date",
  diagnosis: "Diagnosis",
  checkup: "Check-up",
  workingHours: "Working hours",
  weekdays: "Mon–Fri",
  saturday: "Sat",
  signature: "Signature",
  labDoctor: "Lab physician",
  radiologist: "Radiologist",
  doctorComment: "Doctor comment",
  temporarilyUnavailable: "Temporarily unavailable",
  procedureName: "Procedure",
  quantity: "Qty",
  time: "Time",
  room: "Room",
  price: "Price",
  note: "Notes",
  procedures: "Procedures",
  checkupList: "CHECK-UP LIST",
  height: "Height",
  weight: "Weight",
  arrival: "Arrival",
  departure: "Departure",
  address: "Address",
  print: "Print",
  chooseLanguage: "Print language",
  cancel: "Cancel",
  male: "Male",
  female: "Female",
  unknown: "—",
  bloodPressure: "Blood pressure",
  pulse: "Pulse",
  respiration: "Respiration",
  exam: "Examination",
  naftalanOpinion: "Opinion on Naftalan baths / physiotherapy",
  specialty_therapist: "Therapist",
  specialty_cardiologist: "Cardiologist",
  specialty_gynecologist: "Gynecologist",
  specialty_usm: "Ultrasound room",
  specialty_dermatoneurologist: "Dermatoneurologist",
  specialty_cosmetologist: "Cosmetologist",
  specialty_manual_therapist: "Manual therapist",
};

const RU: Dict = {
  ...EN,
  parameter: "Параметр",
  result: "Результат",
  norm: "Норма",
  unit: "Ед.",
  no: "№",
  patient: "Пациент",
  sex: "Пол",
  birthDate: "Дата рождения",
  phone: "Телефон",
  country: "Страна",
  roomNo: "№ палаты",
  doctor: "Врач",
  date: "Дата",
  diagnosis: "Диагноз",
  checkup: "Check-up",
  workingHours: "Часы работы",
  weekdays: "Пн–Пт",
  saturday: "Сб",
  signature: "Подпись",
  labDoctor: "Врач-лаборант",
  radiologist: "Врач-радиолог",
  doctorComment: "Комментарий врача",
  temporarilyUnavailable: "Временно нет",
  procedureName: "Процедура",
  quantity: "Кол-во",
  time: "Время",
  room: "Кабинет",
  price: "Цена",
  note: "Примечание",
  procedures: "Процедуры",
  checkupList: "CHECK-UP LIST",
  height: "Рост",
  weight: "Вес",
  arrival: "Прибытие",
  departure: "Выезд",
  address: "Адрес",
  print: "Печать",
  chooseLanguage: "Язык печати",
  cancel: "Отмена",
  male: "Мужской",
  female: "Женский",
  bloodPressure: "Артериальное давление",
  pulse: "Пульс",
  respiration: "Дыхание",
  exam: "Осмотр врача",
  naftalanOpinion: "Заключение по нафталановым ваннам / физиотерапии",
  specialty_therapist: "Терапевт",
  specialty_cardiologist: "Кардиолог",
  specialty_gynecologist: "Гинеколог",
  specialty_usm: "Кабинет УЗИ",
  specialty_dermatoneurologist: "Дерматоневролог",
  specialty_cosmetologist: "Косметолог",
  specialty_manual_therapist: "Мануальный терапевт",
};

const AZ: Dict = {
  ...EN,
  parameter: "Parametr",
  result: "Nəticə",
  norm: "Norma",
  unit: "Vahid",
  no: "№",
  patient: "Pasiyent",
  sex: "Cins",
  birthDate: "Təvəllüd",
  phone: "Telefon",
  country: "Ölkə",
  roomNo: "Palata №",
  doctor: "Həkim",
  date: "Tarix",
  diagnosis: "Diaqnoz",
  checkup: "Check-up",
  workingHours: "İş saatları",
  weekdays: "I–V",
  saturday: "VI",
  signature: "İmza",
  labDoctor: "Həkim laborant",
  radiologist: "Dr.Radioloq",
  doctorComment: "Həkim şərhi",
  temporarilyUnavailable: "Müvəqqəti yoxdur",
  procedureName: "Prosedur adı",
  quantity: "Say",
  time: "Saat",
  room: "Otaq",
  price: "Qiymət",
  note: "Qeyd",
  procedures: "Prosedurlar",
  checkupList: "CHECK-UP LIST",
  height: "Boy",
  weight: "Çəki",
  arrival: "Gəliş tarixi",
  departure: "Gediş tarixi",
  address: "Ünvan",
  print: "Çap",
  chooseLanguage: "Çap dili",
  cancel: "Ləğv",
  male: "Kişi",
  female: "Qadın",
  bloodPressure: "Arterial təzyiq",
  pulse: "Puls",
  respiration: "Tənəffüs",
  exam: "Həkim baxışı",
  naftalanOpinion: "Naftalan vanna və ya fizioterapiya üzrə rəy",
  specialty_therapist: "Həkim terapevt",
  specialty_cardiologist: "Kardioloq",
  specialty_gynecologist: "Ginekoloq",
  specialty_usm: "USM Kabineti",
  specialty_dermatoneurologist: "Dermatonevroloq",
  specialty_cosmetologist: "Kosmetoloq",
  specialty_manual_therapist: "Manual terapevt",
};

const BY_LANG: Record<PrintLang, Dict> = { en: EN, ru: RU, az: AZ };

export function printLabel(lang: PrintLang, key: string): string {
  return BY_LANG[lang][key] ?? EN[key] ?? key;
}
`,
);

console.log("foundation domain done");
