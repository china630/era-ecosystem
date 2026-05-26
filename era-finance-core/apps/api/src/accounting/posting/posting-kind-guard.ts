import { BadRequestException } from "@nestjs/common";
import { OrganizationKind, type PostingRole } from "@erafinance/database";
import {
  BUDGET_FORBIDDEN_COMMERCIAL_INVOICE_CODES,
  type PostingSchemaId,
} from "./posting-schema-registry";

/** Commercial AR/revenue pair — must not appear on BUDGET auto-postings or overrides. */
export { BUDGET_FORBIDDEN_COMMERCIAL_INVOICE_CODES as BUDGET_FORBIDDEN_COMMERCIAL_CODES };

const INVOICE_REVENUE_ROLES = new Set<PostingRole>([
  "TRADE_RECEIVABLE",
  "TRADE_RECEIVABLE_GOODS",
  "TRADE_RECEIVABLE_SERVICES",
  "SALES_REVENUE",
  "SALES_REVENUE_GOODS",
  "SERVICE_REVENUE",
]);

export function assertBudgetJournalLinesSafe(
  kind: OrganizationKind,
  accountCodes: string[],
): void {
  if (kind !== OrganizationKind.BUDGET) return;
  const forbidden = accountCodes.filter((c) =>
    BUDGET_FORBIDDEN_COMMERCIAL_INVOICE_CODES.has(c.trim()),
  );
  if (forbidden.length > 0) {
    throw new BadRequestException(
      `BUDGET organizations cannot post to commercial accounts (${forbidden.join(", ")}). Use 111-x / 611-x posting profile or gov-budget execution.`,
    );
  }
}

export function assertBudgetPostingRoleOverrideSafe(
  kind: OrganizationKind,
  role: PostingRole,
  accountCode: string,
): void {
  if (kind !== OrganizationKind.BUDGET) return;
  if (!INVOICE_REVENUE_ROLES.has(role)) return;
  if (BUDGET_FORBIDDEN_COMMERCIAL_INVOICE_CODES.has(accountCode.trim())) {
    throw new BadRequestException(
      `BUDGET cannot override ${role} to commercial account ${accountCode}. Use 111-x or 611-x.`,
    );
  }
}

export function assertBudgetInvoiceSchemaSafe(
  kind: OrganizationKind,
  schemaId: PostingSchemaId,
  resolvedCodes: string[],
): void {
  if (kind !== OrganizationKind.BUDGET || schemaId !== "INVOICE_REVENUE_RECOGNITION") {
    return;
  }
  assertBudgetJournalLinesSafe(kind, resolvedCodes);
}
