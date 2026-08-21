import { BadRequestException } from "@nestjs/common";
import {
  isNasCashDeskCode,
  OrganizationKind,
  type Prisma,
} from "@erafinance/database";
import type { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";

/** Счета, которые нельзя использовать как кассу (частая путаница с дебиторкой/кредиторкой). */
const DISALLOWED_AS_CASH = new Set(["211", "531", "538"]);

/**
 * Kind-aware kassa: NAS-GOV 101*; Q-01 / İ-05 221*. Never 223 (bank) or 211/531.
 */
export function assertValidCashDeskAccountCode(
  code: string,
  kind: OrganizationKind = OrganizationKind.COMMERCIAL,
): void {
  const c = code.trim();
  if (DISALLOWED_AS_CASH.has(c)) {
    throw new BadRequestException(
      `Account ${c} cannot be a cash desk; use posting role CASH_AZN / CASH_FOREIGN.`,
    );
  }
  if (!isNasCashDeskCode(kind, c)) {
    throw new BadRequestException(
      kind === OrganizationKind.BUDGET
        ? "Cash desk account must be NAS-GOV 101 (kassa)."
        : "Cash desk account must be Q-01 / İ-05 221 (kassa), not 223 (bank).",
    );
  }
}

/**
 * Если код не передан — CASH_AZN / CASH_FOREIGN по posting role; иначе валидация явного кода.
 */
export async function resolveCashAccountCodeForCurrency(
  organizationId: string,
  currency: string | undefined,
  posting: PostingAccountResolver,
  explicit?: string | null,
  tx?: Prisma.TransactionClient,
): Promise<string> {
  const trimmed = explicit?.trim();
  if (trimmed) {
    const kind = await posting.getOrganizationKind(organizationId);
    assertValidCashDeskAccountCode(trimmed, kind);
    return trimmed;
  }
  const cur = (currency ?? "AZN").toUpperCase();
  const role = cur === "AZN" ? "CASH_AZN" : "CASH_FOREIGN";
  return posting.resolveAccountCode(organizationId, role, tx);
}
