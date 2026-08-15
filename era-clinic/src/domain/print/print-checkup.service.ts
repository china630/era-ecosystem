import { prisma } from "@/lib/prisma";
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
    orderBy: { openedAt: "desc" },
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
      title: printLabel(lang, `specialty_${cfg.specialty}`),
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
      birthDate: patient.birthDate ? patient.birthDate.toISOString().slice(0, 10) : null,
      phone: patient.phone,
      nationality: patient.nationality,
      roomNumber: episode?.roomNumber ?? null,
      doctorName: null,
      date: new Date().toISOString().slice(0, 10),
    },
    arrival: episode?.openedAt ? episode.openedAt.toISOString().slice(0, 10) : null,
    departure: episode?.closedAt ? episode.closedAt.toISOString().slice(0, 10) : null,
    sections,
  };
}
