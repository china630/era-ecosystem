import {
  composePersonFullName,
  linkPersonIdentity,
  normalizeNationalityIso,
  resolveIncomingNameParts,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export async function linkPatientGlobalPerson(input: {
  patientRefId: string;
  fin?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  fullName?: string;
  phone?: string;
  passport?: string;
  issuingCountry?: string;
  nationality?: string;
  sex?: string;
  birthDate?: string | Date | null;
  globalPersonId?: string | null;
}): Promise<string | null> {
  const parts = resolveIncomingNameParts(input);
  const fullName =
    composePersonFullName(parts?.firstName, parts?.middleName, parts?.lastName) ||
    input.fullName?.trim() ||
    "";
  if (!fullName && !input.fin?.trim() && !input.passport?.trim()) return null;

  const linked = await linkPersonIdentity({
    fin: input.fin?.trim(),
    passport: input.passport?.trim(),
    issuingCountry: input.issuingCountry?.trim() || undefined,
    firstName: parts?.firstName?.trim() || undefined,
    middleName: parts?.middleName?.trim() || undefined,
    lastName: parts?.lastName?.trim() || undefined,
    fullName: fullName || undefined,
    phone: input.phone?.trim(),
    nationality: normalizeNationalityIso(input.nationality) ?? undefined,
    sex: input.sex,
    birthDate: input.birthDate ?? undefined,
    globalPersonId: input.globalPersonId?.trim() || undefined,
  });

  const persist: Record<string, string | null> = {};
  const nationality = normalizeNationalityIso(input.nationality);
  if (nationality) persist.nationality = nationality;
  if (linked.globalPersonId) persist.globalPersonId = linked.globalPersonId;

  if (Object.keys(persist).length > 0) {
    await prisma.patientRef.update({
      where: { id: input.patientRefId },
      data: persist,
    });
  }
  return linked.globalPersonId;
}
