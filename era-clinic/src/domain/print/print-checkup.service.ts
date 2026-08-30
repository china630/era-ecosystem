import { prisma } from "@/lib/prisma";
import { getCheckupSectionsConfig, getPrintBranding } from "@/domain/print/print-branding.service";
import { printLabel } from "@/domain/print/print-labels";
import type { PrintBranding, PrintLang, PrintPatientStrip } from "@/domain/print/print-types";
import { getIntakeChecklist } from "@/domain/patient/intake-checklist.service";
import { printSpecialtyForIntakeSlot } from "@/lib/import/nafta-intake-map";

export type PrintCheckupSection = {
  specialty: string;
  title: string;
  enabled: boolean;
  doctorName: string | null;
  scheduleHint: string | null;
  status?: string | null;
};

export type PrintCheckupDocument = {
  branding: PrintBranding;
  patient: PrintPatientStrip;
  arrival: string | null;
  departure: string | null;
  diagnoses: string[];
  sections: PrintCheckupSection[];
};

function specialtyAliases(specialty: string): string[] {
  const s = specialty.toLowerCase();
  const map: Record<string, string[]> = {
    therapist: ["therapist", "terapevt", "gp", "general"],
    cardiologist: ["cardio", "kardioloq", "cardiologist"],
    gynecologist: ["gyne", "gine", "ginekoloq", "uro"],
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

function pickTitle(
  lang: PrintLang,
  title: { en: string; ru: string; az: string },
): string {
  if (lang === "ru") return title.ru;
  if (lang === "az") return title.az;
  return title.en;
}

export async function buildCheckupPrint(
  patientId: string,
  lang: PrintLang,
): Promise<PrintCheckupDocument | null> {
  const patient = await prisma.patientRef.findUnique({ where: { id: patientId } });
  if (!patient) return null;

  const branding = await getPrintBranding(lang);
  const config = await getCheckupSectionsConfig();
  const [episode, appointments, intake] = await Promise.all([
    prisma.clinicalEpisode.findFirst({
      where: { patientRefId: patientId },
      orderBy: { openedAt: "desc" },
      include: {
        diagnoses: {
          include: { icdCode: true },
          orderBy: { recordedAt: "asc" },
        },
      },
    }),
    prisma.appointment.findMany({
      where: { patientRefId: patientId },
      include: { practitioner: true },
      orderBy: { scheduledAt: "asc" },
    }),
    getIntakeChecklist(patientId),
  ]);

  const intakeBySpecialty = new Map(
    intake.items.map((item) => [printSpecialtyForIntakeSlot(item.slot), item]),
  );

  const sections = config.map((cfg) => {
    const apt = appointments.find((a) => matchesSpecialty(a.practitioner.specialty, cfg.specialty));
    const intakeItem = intakeBySpecialty.get(cfg.specialty);
    return {
      specialty: cfg.specialty,
      title: intakeItem
        ? pickTitle(lang, intakeItem.title)
        : printLabel(lang, `specialty_${cfg.specialty}`),
      enabled: cfg.enabled,
      doctorName: apt?.practitioner.fullName ?? null,
      scheduleHint: apt
        ? apt.scheduledAt.toLocaleString("en-GB", {
            timeZone: "Asia/Baku",
            hour: "2-digit",
            minute: "2-digit",
          })
        : null,
      status: intakeItem?.status ?? null,
    };
  });

  const diagnoses = (episode?.diagnoses ?? []).map((d) => {
    const title =
      lang === "ru"
        ? d.icdCode.titleRu
        : lang === "az"
          ? d.icdCode.titleAz?.trim() || d.icdCode.titleRu
          : d.icdCode.titleEn;
    const base = `${d.icdCode.code} — ${title}`;
    return d.note ? `${base} (${d.note})` : base;
  });

  return {
    branding,
    patient: {
      fullName: patient.fullName,
      sex: patient.sex,
      birthDate: patient.birthDate ? patient.birthDate.toISOString().slice(0, 10) : null,
      phone: patient.phone,
      nationality: patient.nationality,
      roomNumber: episode?.roomNumber ?? null,
      doctorName: null,
      date: new Date().toISOString().slice(0, 10),
    },
    arrival: episode?.openedAt ? episode.openedAt.toISOString().slice(0, 10) : null,
    departure: episode?.closedAt ? episode.closedAt.toISOString().slice(0, 10) : null,
    diagnoses,
    sections,
  };
}
