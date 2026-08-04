export type PrintLang = "en" | "ru" | "az";

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

export const DEFAULT_CHECKUP_SECTIONS: CheckupSectionConfig[] = [{"specialty":"therapist","enabled":true},{"specialty":"cardiologist","enabled":true},{"specialty":"gynecologist","enabled":true},{"specialty":"usm","enabled":true},{"specialty":"dermatoneurologist","enabled":true},{"specialty":"cosmetologist","enabled":false},{"specialty":"manual_therapist","enabled":true}];
