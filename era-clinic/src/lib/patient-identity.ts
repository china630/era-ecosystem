import { lookupGlobalPersonByFin, resolvePersonIdentity } from "@era/satellite-kit";
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
  let globalPersonId: string | null = null;
  if (input.fin?.trim()) {
    const r = await lookupGlobalPersonByFin(input.fin.trim());
    globalPersonId = r.globalPersonId;
  }
  if (!globalPersonId && input.fullName?.trim()) {
    const r = await resolvePersonIdentity({
      fin: input.fin?.trim(),
      passport: input.passport?.trim(),
      issuingCountry: input.issuingCountry?.trim() ?? input.nationality?.trim(),
      fullName: input.fullName.trim(),
      phone: input.phone?.trim(),
      nationality: input.nationality?.trim(),
    });
    globalPersonId = r.globalPersonId;
  }
  const persist: Record<string, string | null> = {};
  if (input.nationality?.trim()) persist.nationality = input.nationality.trim();
  if (input.fin?.trim()) persist.finCode = input.fin.trim();
  if (input.passport?.trim()) persist.passportNumber = input.passport.trim();
  if (input.issuingCountry?.trim()) persist.issuingCountry = input.issuingCountry.trim();
  if (globalPersonId) persist.globalPersonId = globalPersonId;

  if (Object.keys(persist).length > 0) {
    await prisma.patientRef.update({
      where: { id: input.patientRefId },
      data: persist,
    });
  }
  return globalPersonId;
}
