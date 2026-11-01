import {
  amountForLedgerRow,
} from "@/domain/reports/patient-assignment-ledger";

/**
 * Package burns must never look like unpaid cash to the ledger helpers.
 * Heal + pending filters are covered in service integration; this locks the money rule.
 */
describe("diagnostics package money rules", () => {
  it("package completed rows contribute 0 amount", () => {
    expect(
      amountForLedgerRow({
        completed: true,
        amountNet: 45,
        inPackage: true,
        settledAt: new Date("2026-11-01"),
        kind: "lab",
      }),
    ).toBe(0);
    expect(
      amountForLedgerRow({
        completed: true,
        amountNet: 15,
        inPackage: true,
        paymentReceiptRef: "R-1",
        kind: "procedure",
      }),
    ).toBe(0);
  });

  it("paid settled labs contribute amount", () => {
    expect(
      amountForLedgerRow({
        completed: true,
        amountNet: 45,
        inPackage: false,
        settledAt: new Date("2026-11-01"),
        kind: "lab",
      }),
    ).toBe(45);
  });
});
