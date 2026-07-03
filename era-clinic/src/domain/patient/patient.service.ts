import { listPersonIdentifiers } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { linkPatientGlobalPerson } from "@/lib/patient-identity";
import { patientHasMdmIdentifier } from "@era/clinic-domain";

export class PatientMdmRequiredError extends Error {
  constructor(message = "Patient must resolve to globalPersonId via FIN, passport, or MDM") {
    super(message);
    this.name = "PatientMdmRequiredError";
  }
}

export type PatientIdentifierInput = {
  finCode?: string;
  passportNumber?: string;
  issuingCountry?: string;
  phone?: string;
};

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
  const row = await prisma.patientRef.findUnique({ where: { id } });
  if (!row) return null;
  if (!row.globalPersonId) {
    return { ...row, identifiersSummary: [] as { type: string; issuingCountry: string | null; isPrimary: boolean }[] };
  }
  const mdm = await listPersonIdentifiers(row.globalPersonId);
  return {
    ...row,
    identifiersSummary: (mdm.identifiers ?? []).map((i) => ({
      type: i.type,
      issuingCountry: i.issuingCountry,
      isPrimary: i.isPrimary,
    })),
  };
}

export async function createPatient(data: {
  refCode: string;
  fullName: string;
  phone?: string;
  nationality?: string;
  finCode?: string;
  passportNumber?: string;
  issuingCountry?: string;
}) {
  if (!patientHasMdmIdentifier(data)) {
    throw new PatientMdmRequiredError(
      "Provide FIN, passport with issuing country, or phone for MDM resolve",
    );
  }

  const patient = await prisma.patientRef.create({
    data: {
      refCode: data.refCode,
      fullName: data.fullName,
      phone: data.phone,
      nationality: data.nationality,
    },
  });

  const globalPersonId = await linkPatientGlobalPerson({
    patientRefId: patient.id,
    fin: data.finCode,
    fullName: data.fullName,
    phone: data.phone,
    passport: data.passportNumber,
    issuingCountry: data.issuingCountry,
    nationality: data.nationality,
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
    nationality?: string | null;
    finCode?: string | null;
    passportNumber?: string | null;
    issuingCountry?: string | null;
  },
) {
  const identityInput: PatientIdentifierInput = {
    finCode: data.finCode ?? undefined,
    passportNumber: data.passportNumber ?? undefined,
    issuingCountry: data.issuingCountry ?? undefined,
    phone: data.phone ?? undefined,
  };
  const identityTouched =
    data.finCode !== undefined ||
    data.passportNumber !== undefined ||
    data.issuingCountry !== undefined ||
    data.phone !== undefined;

  const updated = await prisma.patientRef.update({
    where: { id },
    data: {
      fullName: data.fullName,
      phone: data.phone,
      nationality: data.nationality,
    },
  });

  if (identityTouched) {
    const globalPersonId = await linkPatientGlobalPerson({
      patientRefId: id,
      fin: identityInput.finCode,
      fullName: updated.fullName,
      phone: identityInput.phone ?? updated.phone ?? undefined,
      passport: identityInput.passportNumber,
      issuingCountry: identityInput.issuingCountry,
      nationality: updated.nationality ?? undefined,
    });
    const withMdm = await prisma.patientRef.findUniqueOrThrow({ where: { id } });
    if (!withMdm.globalPersonId && !globalPersonId) {
      throw new PatientMdmRequiredError();
    }
    return getPatient(id);
  }

  return updated;
}
