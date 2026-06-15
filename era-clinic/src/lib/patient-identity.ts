import { linkPersonIdentity } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export async function linkPatientGlobalPerson(input: {
  patientRefId: string;
  fin?: string;
  fullName?: string;
  phone?: string;
  passport?: string;
  issuingCountry?: string;
  nationality?: string;
}): Promise<string | null> {
  if (!input.fullName?.trim()) return null;

  const linked = await linkPersonIdentity({
    fin: input.fin?.trim(),
    passport: input.passport?.trim(),
    issuingCountry: input.issuingCountry?.trim() ?? input.nationality?.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone?.trim(),
    nationality: input.nationality?.trim(),
  });

  const persist: Record<string, string | null> = {};
  if (input.nationality?.trim()) persist.nationality = input.nationality.trim();
  if (input.fin?.trim()) persist.finCode = input.fin.trim();
  if (input.passport?.trim()) persist.passportNumber = input.passport.trim();
  if (input.issuingCountry?.trim()) persist.issuingCountry = input.issuingCountry.trim();
  if (linked.globalPersonId) persist.globalPersonId = linked.globalPersonId;

  if (Object.keys(persist).length > 0) {
    await prisma.patientRef.update({
      where: { id: input.patientRefId },
      data: persist,
    });
  }
  return linked.globalPersonId;
}
