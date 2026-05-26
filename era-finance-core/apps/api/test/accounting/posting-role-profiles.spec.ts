import { OrganizationKind } from "@erafinance/database";
import {
  BUDGET_FORBIDDEN_COMMERCIAL_INVOICE_CODES,
  getPostingSchema,
} from "../../src/accounting/posting/posting-schema-registry";
import { assertBudgetInvoiceSchemaSafe } from "../../src/accounting/posting/posting-kind-guard";
import { validatePostingRolesAgainstCharts } from "@erafinance/database";

describe("posting role profiles", () => {
  it("contract: posting role presets reference chart or runtime allowlist", async () => {
    await expect(validatePostingRolesAgainstCharts()).resolves.toBeUndefined();
  });

  it("BUDGET forbids commercial 211+601 on invoice revenue schema", () => {
    expect(() =>
      assertBudgetInvoiceSchemaSafe(OrganizationKind.BUDGET, "INVOICE_REVENUE_RECOGNITION", [
        "111-1",
        "601",
      ]),
    ).toThrow(/cannot post to commercial accounts/);

    expect(() =>
      assertBudgetInvoiceSchemaSafe(OrganizationKind.BUDGET, "INVOICE_REVENUE_RECOGNITION", [
        "111-1",
        "611-1",
      ]),
    ).not.toThrow();
  });

  it("invoice revenue schema defines debit/credit roles", () => {
    const schema = getPostingSchema("INVOICE_REVENUE_RECOGNITION");
    expect(schema.lines).toHaveLength(2);
    expect(BUDGET_FORBIDDEN_COMMERCIAL_INVOICE_CODES.has("211")).toBe(true);
    expect(BUDGET_FORBIDDEN_COMMERCIAL_INVOICE_CODES.has("601")).toBe(true);
  });
});
