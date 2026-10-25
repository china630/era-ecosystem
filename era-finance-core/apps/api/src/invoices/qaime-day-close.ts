/** A registered buyer (legal entity, VAT payer, or a stored VÖEN) without a number holds the day. */
export function invoiceHoldsDayForMissingEqaime(input: {
  status: string;
  isInternational: boolean;
  currency: string;
  counterpartyKind: string;
  isVatPayer: boolean;
  hasTaxId: boolean;
  eqaimeNumber: string | null;
}): boolean {
  if (input.status === "DRAFT" || input.status === "CANCELLED") return false;
  if (input.isInternational || input.currency !== "AZN") return false;
  const registered =
    input.counterpartyKind === "LEGAL_ENTITY" || input.isVatPayer || input.hasTaxId;
  if (!registered) return false;
  const number = input.eqaimeNumber?.trim() ?? "";
  return number.length === 0;
}

/** Local patch only. Does not describe a gateway submission. */
export function manualEqaimeLinkPatch(raw: string): {
  eqaimeNumber: string;
  eqaimeStatus: "MANUAL";
} {
  const eqaimeNumber = raw.trim();
  if (!eqaimeNumber) {
    throw new Error("e-qaimə number is empty");
  }
  return { eqaimeNumber, eqaimeStatus: "MANUAL" };
}
