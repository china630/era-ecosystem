import { debtStatusRegistryAlertLevel } from "../src/modules/loans/credit-debt-status.util";

describe("CKR debt status alert (P1-3)", () => {
  it("no alert at 25 days or less", () => {
    expect(debtStatusRegistryAlertLevel(25)).toEqual({
      level: "ok",
      alert: false,
    });
  });

  it("warning alert after 25 days", () => {
    expect(debtStatusRegistryAlertLevel(26)).toEqual({
      level: "warning",
      alert: true,
    });
  });

  it("overdue after 30 days", () => {
    expect(debtStatusRegistryAlertLevel(31)).toEqual({
      level: "overdue",
      alert: true,
    });
  });
});