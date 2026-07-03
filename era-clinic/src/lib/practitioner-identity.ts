import { linkPersonIdentity } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

const STRICT =
  (process.env.ERA_CLINIC_PRACTITIONER_MDM_STRICT ?? "true").toLowerCase() !== "false";

export class PractitionerMdmRequiredError extends Error {
  constructor(
    message = "Practitioner requires MDM link (FIN or passport with issuing country)",
  ) {
    super(message);
    this.name = "PractitionerMdmRequiredError";
  }
}

export function practitionerHasIdentifierInput(input: {
  fin?: string;
  passport?: string;
  issuingCountry?: string;
}): boolean {
  if (input.fin?.trim()) return true;
  if (input.passport?.trim() && input.issuingCountry?.trim()) return true;
  return false;
}

export function practitionerMdmStrictEnabled(): boolean {
  return STRICT;
}

/** Resolve-or-create in MDM before practitioner row insert (strict create). */
export async function resolvePractitionerGlobalPerson(input: {
  fullName: string;
  fin?: string;
  passport?: string;
  issuingCountry?: string;
  phone?: string;
  nationality?: string;
}): Promise<string> {
  if (!practitionerHasIdentifierInput(input)) {
    throw new PractitionerMdmRequiredError(
      "Provide FIN or passport with issuing country for practitioner create",
    );
  }

  const linked = await linkPersonIdentity({
    fin: input.fin?.trim(),
    passport: input.passport?.trim(),
    issuingCountry: input.issuingCountry?.trim() ?? input.nationality?.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone?.trim(),
    nationality: input.nationality?.trim(),
  });

  if (!linked.globalPersonId) {
    throw new PractitionerMdmRequiredError(
      STRICT
        ? "MDM linkage required for practitioner (FIN or passport+country)"
        : "Could not resolve practitioner identity in MDM",
    );
  }

  return linked.globalPersonId;
}

/** Re-link practitioner after identifier change — persists globalPersonId only. */
export async function linkPractitionerGlobalPerson(input: {
  practitionerId: string;
  fullName: string;
  fin?: string;
  passport?: string;
  issuingCountry?: string;
  phone?: string;
  nationality?: string;
}): Promise<string | null> {
  const hasId = practitionerHasIdentifierInput(input);
  if (!hasId && STRICT) {
    throw new PractitionerMdmRequiredError();
  }
  if (!hasId) {
    return null;
  }

  const linked = await linkPersonIdentity({
    fin: input.fin?.trim(),
    passport: input.passport?.trim(),
    issuingCountry: input.issuingCountry?.trim() ?? input.nationality?.trim(),
    fullName: input.fullName.trim(),
    phone: input.phone?.trim(),
    nationality: input.nationality?.trim(),
  });

  if (linked.globalPersonId) {
    await prisma.practitioner.update({
      where: { id: input.practitionerId },
      data: { globalPersonId: linked.globalPersonId },
    });
  }

  if (STRICT && !linked.globalPersonId) {
    throw new PractitionerMdmRequiredError(
      "MDM linkage required for practitioner (FIN or passport+country)",
    );
  }

  return linked.globalPersonId;
}
