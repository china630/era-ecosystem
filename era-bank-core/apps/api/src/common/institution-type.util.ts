import { BadRequestException } from "@nestjs/common";
import { InstitutionType, ProductKind } from "@era/bank-core-database";

/** Retail deposit products BOKT (NBCO) must not activate. */
export const BOKT_FORBIDDEN_DEPOSIT_KINDS: readonly ProductKind[] = [
  ProductKind.TERM_DEPOSIT,
  ProductKind.SAVINGS,
  ProductKind.CALL_DEPOSIT,
  ProductKind.STRUCTURED_DEPOSIT,
];

/** LEASING_COMPANY may only activate lease-oriented kinds (lab gate). */
export const LEASING_ALLOWED_KINDS: readonly ProductKind[] = [
  ProductKind.LOAN_LEASE,
  ProductKind.CURRENT,
];

/** CREDIT_UNION: deposits + simple loans; no cards / trade / islamic FO. */
export const CREDIT_UNION_FORBIDDEN_KINDS: readonly ProductKind[] = [
  ProductKind.CARD,
  ProductKind.LOAN_TRADE,
  ProductKind.LOAN_SYNDICATED,
  ProductKind.LOAN_LEASE,
  ProductKind.MURABAHA,
  ProductKind.MUDARABAH,
];

/** Reg-report template codes typically for BOKT lab pack (null = all). */
export const BOKT_REG_TEMPLATE_CODES: readonly string[] = [
  "CBAR_TRIAL_BALANCE",
  "CBAR_CREDIT_PORTFOLIO_BY_CATEGORY",
  "CBAR_LCR_STUB",
];

export function assertInstitutionAllowsProductKind(
  institutionType: InstitutionType,
  kind: ProductKind,
): void {
  if (institutionType === InstitutionType.BOKT) {
    if (BOKT_FORBIDDEN_DEPOSIT_KINDS.includes(kind)) {
      throw new BadRequestException(
        `BOKT institutions cannot activate retail deposit product kind ${kind}`,
      );
    }
    return;
  }
  if (institutionType === InstitutionType.LEASING_COMPANY) {
    if (!LEASING_ALLOWED_KINDS.includes(kind)) {
      throw new BadRequestException(
        `LEASING_COMPANY cannot activate product kind ${kind} (lease/current only)`,
      );
    }
    return;
  }
  if (institutionType === InstitutionType.CREDIT_UNION) {
    if (CREDIT_UNION_FORBIDDEN_KINDS.includes(kind)) {
      throw new BadRequestException(
        `CREDIT_UNION cannot activate product kind ${kind}`,
      );
    }
  }
}

export function filterRegTemplateCodesForInstitution(
  institutionType: InstitutionType,
  codes: string[],
): string[] {
  if (institutionType === InstitutionType.BOKT) {
    return codes.filter((c) =>
      (BOKT_REG_TEMPLATE_CODES as readonly string[]).includes(c),
    );
  }
  if (institutionType === InstitutionType.LEASING_COMPANY) {
    return codes.filter(
      (c) =>
        c === "CBAR_TRIAL_BALANCE" ||
        c === "CBAR_CREDIT_PORTFOLIO_BY_CATEGORY" ||
        c === "CBAR_PNL_STUB",
    );
  }
  return codes;
}
