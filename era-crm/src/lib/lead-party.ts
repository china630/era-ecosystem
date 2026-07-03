import type { Lead, LeadStage, PartyKind } from "@prisma/client";

const QUALIFIED_PLUS: LeadStage[] = [
  "QUALIFIED",
  "PROPOSAL",
  "WON",
  "LOST",
];

export function isQualifiedPlus(stage: LeadStage): boolean {
  return QUALIFIED_PLUS.includes(stage);
}

export function validatePartyForStage(
  lead: Pick<
    Lead,
    | "partyKind"
    | "taxId"
    | "companyName"
    | "contactPhone"
    | "stage"
  >,
  targetStage: LeadStage,
): string | null {
  if (!isQualifiedPlus(targetStage)) return null;

  if (lead.partyKind === "LEGAL_ENTITY") {
    if (!lead.taxId?.trim() || !/^\d{10}$/.test(lead.taxId.trim())) {
      return "VÖEN (10 digits) required for legal entity at this stage";
    }
    if (!lead.companyName?.trim()) {
      return "Company name required for legal entity at this stage";
    }
  }

  if (lead.partyKind === "INDIVIDUAL") {
    if (!lead.contactPhone?.trim()) {
      return "Contact phone required for individual at this stage";
    }
  }

  return null;
}

export function normalizeAzPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("994")) return `+${digits}`;
  if (digits.length === 9) return `+994${digits}`;
  if (phone.startsWith("+")) return phone.trim();
  return phone.trim();
}

export function syncContactRef(
  contactRef: string | undefined,
  contactPhone: string | undefined,
  channel: string,
): string {
  if (contactRef?.trim()) return contactRef.trim();
  if (
    contactPhone?.trim() &&
    (channel === "whatsapp" || channel === "phone")
  ) {
    return normalizeAzPhone(contactPhone);
  }
  return contactPhone?.trim() ?? "";
}

export function inferPartyKind(
  partyKind: PartyKind | undefined,
  taxId: string | undefined,
): PartyKind {
  if (partyKind) return partyKind;
  if (taxId?.trim() && /^\d{10}$/.test(taxId.trim())) return "LEGAL_ENTITY";
  return "INDIVIDUAL";
}

export function buildConvertPartyPayload(lead: Lead) {
  return {
    partyKind: lead.partyKind,
    taxId: lead.taxId ?? undefined,
    companyName: lead.companyName ?? undefined,
    contactPhone: lead.contactPhone ?? undefined,
    contactEmail: lead.contactEmail ?? undefined,
    globalPersonId: lead.globalPersonId ?? undefined,
    activitySector: lead.activitySector ?? undefined,
    prospectType: lead.prospectType,
  };
}
