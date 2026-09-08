import type { PersonIdentifierTypeKey } from "../common/utils/mdm-crypto.util";

export type ResolvePersonInput = {
  fin?: string;
  passport?: string;
  issuingCountry?: string;
  residencePermit?: string;
  nationalId?: string;
  /** Denorm / legacy blob. Prefer firstName + lastName (+ middleName). */
  fullName?: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  phone?: string;
  /** ISO 3166-1 alpha-2 citizenship. OTHER/garbage ignored on write. */
  nationality?: string;
  /** Update this person when already linked (hotel/clinic card edit without re-entering FIN). */
  globalPersonId?: string;
  sex?: string;
  gender?: string;
  birthDate?: string | Date | null;
};

export type IdentifierInput = {
  type: PersonIdentifierTypeKey;
  value: string;
  issuingCountry?: string;
};

export function inferPersonSegment(
  nationality: string | undefined,
  identifiers: IdentifierInput[],
): "CITIZEN" | "FOREIGNER" | "UNVERIFIED" {
  const nat = (nationality ?? "AZ").trim().toUpperCase();
  if (identifiers.some((i) => i.type === "AZ_FIN")) return "CITIZEN";
  if (nat && nat !== "AZ" && nat !== "OTHER") return "FOREIGNER";
  if (identifiers.some((i) => i.type === "PASSPORT" || i.type === "RESIDENCE_PERMIT")) {
    return "FOREIGNER";
  }
  return "UNVERIFIED";
}

export function collectIdentifierInputs(
  input: ResolvePersonInput,
): IdentifierInput[] {
  const out: IdentifierInput[] = [];
  // Do not fall back to nationality for passport/residence — issuingCountry is document SoR.
  // Last-resort AZ only when satellites omit the field (steps 3–4 will send country).
  const docCountry = input.issuingCountry?.trim() || "AZ";
  if (input.fin?.trim()) {
    out.push({ type: "AZ_FIN", value: input.fin.trim(), issuingCountry: "AZ" });
  }
  if (input.passport?.trim()) {
    out.push({
      type: "PASSPORT",
      value: input.passport.trim(),
      issuingCountry: docCountry,
    });
  }
  if (input.residencePermit?.trim()) {
    out.push({
      type: "RESIDENCE_PERMIT",
      value: input.residencePermit.trim(),
      issuingCountry: docCountry,
    });
  }
  if (input.nationalId?.trim()) {
    out.push({
      type: "NATIONAL_ID",
      value: input.nationalId.trim(),
      issuingCountry: docCountry,
    });
  }
  return out;
}
