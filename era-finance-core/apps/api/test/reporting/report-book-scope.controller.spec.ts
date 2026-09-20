jest.mock("@era365/database", () => ({
  PrismaClient: class PrismaClient {},
}));

import { LedgerType } from "@erafinance/database";
import { ReportingController } from "../../src/reporting/reporting.controller";

describe("ReportingController accounting book scope", () => {
  const reporting = {
    accountsReceivableAging: jest.fn(),
    accountsPayableAging: jest.fn(),
    creditorPaymentPlan: jest.fn(),
  };
  const standardReports = {
    subcontoAnalysis: jest.fn(),
  };
  const controller = new ReportingController(
    reporting as never,
    standardReports as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("forwards accountingBookId through aging and creditor report routes", () => {
    controller.arAging("org-1", "2026-09-08", "IFRS", "book-2");
    controller.apAging("org-1", "2026-09-08", "IFRS", "book-2");
    controller.creditorPaymentPlan("org-1", "2026-09-08", "IFRS", "book-2");

    expect(reporting.accountsReceivableAging).toHaveBeenCalledWith(
      "org-1",
      "2026-09-08",
      LedgerType.IFRS,
      "book-2",
    );
    expect(reporting.accountsPayableAging).toHaveBeenCalledWith(
      "org-1",
      "2026-09-08",
      LedgerType.IFRS,
      "book-2",
    );
    expect(reporting.creditorPaymentPlan).toHaveBeenCalledWith(
      "org-1",
      "2026-09-08",
      LedgerType.IFRS,
      "book-2",
    );
  });

  it("forwards accountingBookId through subconto analysis", () => {
    controller.subcontoAnalysis(
      "org-1",
      "2026-09-01",
      "2026-09-08",
      "subconto-1",
      "211",
      "MANAGEMENT",
      "book-3",
    );

    expect(standardReports.subcontoAnalysis).toHaveBeenCalledWith(
      "org-1",
      "2026-09-01",
      "2026-09-08",
      "subconto-1",
      "211",
      LedgerType.MANAGEMENT,
      "book-3",
    );
  });
});
