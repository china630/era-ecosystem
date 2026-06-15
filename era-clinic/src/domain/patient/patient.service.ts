import { prisma } from "@/lib/prisma";
import { linkPatientGlobalPerson } from "@/lib/patient-identity";

export class PatientMdmRequiredError extends Error {
  constructor(message = "Patient must resolve to globalPersonId via FIN, passport, or MDM") {
    super(message);
    this.name = "PatientMdmRequiredError";
  }
}

function hasIdentifier(data: {
  finCode?: string;
  passportNumber?: string;
  issuingCountry?: string;
  phone?: string;
}) {
  if (data.finCode?.trim()) return true;
  if (data.passportNumber?.trim() && data.issuingCountry?.trim()) return true;
  if (data.phone?.trim()) return true;
  return false;
}

export async function listPatients(query?: string) {
  const where = query?.trim()
    ? {
        OR: [
          { fullName: { contains: query.trim(), mode: "insensitive" as const } },
          { refCode: { contains: query.trim(), mode: "insensitive" as const } },
          { phone: { contains: query.trim(), mode: "insensitive" as const } },
        ],
      }
    : undefined;
  return prisma.patientRef.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function getPatient(id: string) {
  return prisma.patientRef.findUnique({ where: { id } });
}

export async function createPatient(data: {
  refCode: string;
  fullName: string;
  phone?: string;
  finCode?: string;
  passportNumber?: string;
  issuingCountry?: string;
}) {
  if (!hasIdentifier(data)) {
    throw new PatientMdmRequiredError(
      "Provide FIN, passport with issuing country, or phone for MDM resolve",
    );
  }

  const patient = await prisma.patientRef.create({
    data: {
      refCode: data.refCode,
      fullName: data.fullName,
      phone: data.phone,
      finCode: data.finCode,
      passportNumber: data.passportNumber,
      issuingCountry: data.issuingCountry,
    },
  });

  const globalPersonId = await linkPatientGlobalPerson({
    patientRefId: patient.id,
    fin: data.finCode,
    fullName: data.fullName,
    phone: data.phone,
    passport: data.passportNumber,
    issuingCountry: data.issuingCountry,
  });

  const updated = await prisma.patientRef.findUniqueOrThrow({
    where: { id: patient.id },
  });

  if (!updated.globalPersonId && !globalPersonId) {
    await prisma.patientRef.delete({ where: { id: patient.id } });
    throw new PatientMdmRequiredError();
  }

  return updated;
}

export async function updatePatient(
  id: string,
  data: {
    fullName?: string;
    phone?: string | null;
    finCode?: string | null;
    passportNumber?: string | null;
    issuingCountry?: string | null;
  },
) {
  const updated = await prisma.patientRef.update({ where: { id }, data });

  if (
    data.finCode !== undefined ||
    data.passportNumber !== undefined ||
    data.phone !== undefined
  ) {
    await linkPatientGlobalPerson({
      patientRefId: id,
      fin: updated.finCode ?? undefined,
      fullName: updated.fullName,
      phone: updated.phone ?? undefined,
      passport: updated.passportNumber ?? undefined,
      issuingCountry: updated.issuingCountry ?? undefined,
    });
    const withMdm = await prisma.patientRef.findUniqueOrThrow({ where: { id } });
    if (!withMdm.globalPersonId) {
      throw new PatientMdmRequiredError();
    }
    return withMdm;
  }

  return updated;
}
