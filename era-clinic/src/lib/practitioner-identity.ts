import { linkPersonIdentity } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

const STRICT =
  (process.env.ERA_CLINIC_PRACTITIONER_MDM_STRICT ?? "true").toLowerCase() !== "false";

export async function linkPractitionerGlobalPerson(input: {
  practitionerId: string;
  fullName: string;
  fin?: string;
  passport?: string;
  issuingCountry?: string;
  phone?: string;
  nationality?: string;
}): Promise<string | null> {
  const linked = await linkPersonIdentity({
    fin: input.fin?.trim(),
    passport: input.passport?.trim(),
    issuingCountry: input.issuingCountry?.trim() ?? input.nationality?.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone?.trim(),
    nationality: input.nationality?.trim(),
  });

  const persist: Record<string, string | null> = {};
  if (input.fin?.trim()) persist.finCode = input.fin.trim().toUpperCase();
  if (input.passport?.trim()) persist.passportNumber = input.passport.trim();
  if (input.issuingCountry?.trim()) persist.issuingCountry = input.issuingCountry.trim();
  if (input.phone?.trim()) persist.phone = input.phone.trim();
  if (linked.globalPersonId) persist.globalPersonId = linked.globalPersonId;

  if (Object.keys(persist).length > 0) {
    await prisma.practitioner.update({
      where: { id: input.practitionerId },
      data: persist,
    });
  }

  if (STRICT && !linked.globalPersonId) {
    const hasId = Boolean(
      input.fin?.trim() || (input.passport?.trim() && input.issuingCountry?.trim()),
    );
    if (hasId) {
      throw new Error("MDM linkage required for practitioner (FIN or passport+country)");
    }
  }

  return linked.globalPersonId;
}

export function practitionerMdmStrictEnabled(): boolean {
  return STRICT;
}
