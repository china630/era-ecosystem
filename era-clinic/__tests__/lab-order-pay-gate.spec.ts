import {
  assertLabOrderReadyForWork,
  isLabOrderAwaitingPayment,
  LAB_AWAITING_PAYMENT,
  labAwaitingPaymentDenied,
  labOrderVisibleToLabWhere,
} from "@/domain/lab/lab-order-pay-gate";

describe("lab order pay gate", () => {
  it("treats priced unpaid rows as awaiting payment", () => {
    expect(isLabOrderAwaitingPayment({ amountNet: 30, settledAt: null })).toBe(true);
    expect(isLabOrderAwaitingPayment({ amountNet: 0, settledAt: null })).toBe(false);
    expect(
      isLabOrderAwaitingPayment({ amountNet: 30, settledAt: new Date("2026-10-01") }),
    ).toBe(false);
  });

  it("refuses collect/results while awaiting payment", () => {
    expect(() =>
      assertLabOrderReadyForWork({ amountNet: 25, settledAt: null }),
    ).toThrow(/awaits payment/i);
    try {
      assertLabOrderReadyForWork({ amountNet: 25, settledAt: null });
    } catch (err) {
      expect((err as { code?: string }).code).toBe(LAB_AWAITING_PAYMENT);
    }
    expect(() =>
      assertLabOrderReadyForWork({ amountNet: 0, settledAt: null }),
    ).not.toThrow();
  });

  it("hides unpaid priced rows from the lab journal filter", () => {
    expect(labOrderVisibleToLabWhere()).toEqual({
      OR: [{ amountNet: { lte: 0 } }, { settledAt: { not: null } }],
    });
  });

  it("maps awaiting payment to a 409 HTTP deny shape", () => {
    expect(labAwaitingPaymentDenied({ amountNet: 10, settledAt: null })).toEqual({
      message: "Lab order awaits payment",
      status: 409,
      code: LAB_AWAITING_PAYMENT,
    });
    expect(labAwaitingPaymentDenied({ amountNet: 0, settledAt: null })).toBeNull();
  });
});
