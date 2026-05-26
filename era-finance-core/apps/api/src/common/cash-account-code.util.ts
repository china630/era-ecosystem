import { BadRequestException } from "@nestjs/common";
import type { Prisma } from "@erafinance/database";
import type { PostingAccountResolver } from "../accounting/posting/posting-account-resolver.service";

/** Счета, которые нельзя использовать как кассу (частая путаница с 101/102). */
const DISALLOWED_AS_CASH = new Set(["211", "531", "538"]);

/**
 * Проверка: касса только под 101* (AZN) или 102* (ин. валюта), не 211/531/538.
 */
export function assertValidCashDeskAccountCode(code: string): void {
  const c = code.trim();
  if (DISALLOWED_AS_CASH.has(c)) {
    throw new BadRequestException(
      `Счёт ${c} не может быть кассовым; используйте 101 / 101.xx (AZN) или 102 / 102.xx (ин. валюта).`,
    );
  }
  const ok =
    c === "101" ||
    c.startsWith("101.") ||
    c === "102" ||
    c.startsWith("102.");
  if (!ok) {
    throw new BadRequestException(
      "Кассовый счёт должен быть в группе 101 (манаты) или 102 (ин. валюта) по плану счетов АР.",
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
    assertValidCashDeskAccountCode(trimmed);
    return trimmed;
  }
  const cur = (currency ?? "AZN").toUpperCase();
  const role = cur === "AZN" ? "CASH_AZN" : "CASH_FOREIGN";
  return posting.resolveAccountCode(organizationId, role, tx);
}
