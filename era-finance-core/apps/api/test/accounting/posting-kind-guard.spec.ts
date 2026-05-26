import { OrganizationKind } from "@erafinance/database";
import {
  assertBudgetJournalLinesSafe,
  assertBudgetPostingRoleOverrideSafe,
} from "../../src/accounting/posting/posting-kind-guard";

describe("posting kind guard", () => {
  it("rejects BUDGET journal lines with commercial 211 or 601", () => {
    expect(() =>
      assertBudgetJournalLinesSafe(OrganizationKind.BUDGET, ["111-1", "601"]),
    ).toThrow(/cannot post to commercial accounts/);
    expect(() =>
      assertBudgetJournalLinesSafe(OrganizationKind.BUDGET, ["211", "611-1"]),
    ).toThrow(/cannot post to commercial accounts/);
  });

  it("allows BUDGET journal lines with 111-x and 611-x", () => {
    expect(() =>
      assertBudgetJournalLinesSafe(OrganizationKind.BUDGET, ["111-1", "611-2"]),
    ).not.toThrow();
  });

  it("skips guard for COMMERCIAL", () => {
    expect(() =>
      assertBudgetJournalLinesSafe(OrganizationKind.COMMERCIAL, ["211", "601"]),
    ).not.toThrow();
  });

  it("rejects BUDGET override of TRADE_RECEIVABLE to 211", () => {
    expect(() =>
      assertBudgetPostingRoleOverrideSafe(
        OrganizationKind.BUDGET,
        "TRADE_RECEIVABLE",
        "211",
      ),
    ).toThrow(/cannot override/);
  });
});
