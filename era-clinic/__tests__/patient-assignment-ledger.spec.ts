import {
  amountForLedgerRow,
  isLabCompleted,
  isProcedureCompleted,
  isVisitCompleted,
  sumLedgerTotals,
  visitLinesAreInPackage,
} from "@/domain/reports/patient-assignment-ledger";

describe("patient-assignment-ledger", () => {
  it("marks full completion only", () => {
    expect(isProcedureCompleted("COMPLETED")).toBe(true);
    expect(isProcedureCompleted("PENDING_PAY")).toBe(false);
    expect(isProcedureCompleted("UNPAID_MISSED")).toBe(false);
    expect(isLabCompleted("PUBLISHED")).toBe(true);
    expect(isLabCompleted("ORDERED")).toBe(false);
    expect(isVisitCompleted("COMPLETED")).toBe(true);
    expect(isVisitCompleted("IN_PROGRESS")).toBe(false);
  });

  it("does not treat empty visit lines as in-package", () => {
    expect(visitLinesAreInPackage([])).toBe(false);
    expect(visitLinesAreInPackage([{ inPackage: true }])).toBe(true);
    expect(
      visitLinesAreInPackage([{ inPackage: true }, { inPackage: false }]),
    ).toBe(false);
  });

  it("amounts only after payment acceptance; package burns stay 0", () => {
    expect(
      amountForLedgerRow({
        completed: true,
        amountNet: 40,
        inPackage: true,
        settledAt: null,
        kind: "lab",
      }),
    ).toBe(0);
    expect(
      amountForLedgerRow({
        completed: true,
        amountNet: 40,
        inPackage: false,
        settledAt: null,
        kind: "lab",
      }),
    ).toBe(0);
    expect(
      amountForLedgerRow({
        completed: true,
        amountNet: 40,
        inPackage: false,
        settledAt: new Date("2026-11-01"),
        kind: "lab",
      }),
    ).toBe(40);
    expect(
      amountForLedgerRow({
        completed: true,
        amountNet: 25,
        inPackage: false,
        paymentReceiptRef: "R-1",
        kind: "procedure",
      }),
    ).toBe(25);
    expect(
      amountForLedgerRow({
        completed: false,
        amountNet: 25,
        inPackage: false,
        paymentReceiptRef: "R-1",
        kind: "procedure",
      }),
    ).toBe(0);
  });

  it("sums totals", () => {
    expect(
      sumLedgerTotals([
        {
          id: "a",
          kind: "lab",
          code: "X",
          name: "X",
          assigned: 1,
          completed: 1,
          scheduledAt: null,
          scheduledAtLabel: null,
          roomNumber: "101",
          amount: 10.5,
          inPackage: false,
          status: "COMPLETED",
        },
        {
          id: "b",
          kind: "procedure",
          code: "Y",
          name: "Y",
          assigned: 1,
          completed: 0,
          scheduledAt: null,
          scheduledAtLabel: null,
          roomNumber: null,
          amount: 0,
          inPackage: false,
          status: "PENDING_PAY",
        },
      ]),
    ).toEqual({ assigned: 2, completed: 1, amount: 10.5 });
  });
});
