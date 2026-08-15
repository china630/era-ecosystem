import { ForbiddenException, BadRequestException } from "@nestjs/common";
import { PaymentOrderStatus, PaymentRail } from "@era/bank-core-database";

/**
 * Pure helpers mirrored from PaymentsService staff-approve rules
 * (kept here so CI can assert SoD without a live DB).
 */
export function paymentRequiresStaffApproval(rail: PaymentRail): boolean {
  return (
    rail === PaymentRail.AZIPS ||
    rail === PaymentRail.XOHKS ||
    rail === PaymentRail.AOS ||
    rail === PaymentRail.SWIFT
  );
}

export function assertPaymentCheckerSoD(
  makerUserId: string,
  checkerUserId: string,
): void {
  if (makerUserId === checkerUserId) {
    throw new ForbiddenException(
      "Maker cannot approve own payment order (segregation of duties)",
    );
  }
}

export function assertPendingApprovalStatus(status: PaymentOrderStatus): void {
  if (status !== PaymentOrderStatus.PENDING_APPROVAL) {
    throw new BadRequestException(`Cannot approve payment in status ${status}`);
  }
}

describe("payment staff approve SoD", () => {
  it("requires approve for external rails", () => {
    expect(paymentRequiresStaffApproval(PaymentRail.AZIPS)).toBe(true);
    expect(paymentRequiresStaffApproval(PaymentRail.SWIFT)).toBe(true);
    expect(paymentRequiresStaffApproval(PaymentRail.INTERNAL)).toBe(false);
  });

  it("blocks maker as checker", () => {
    expect(() => assertPaymentCheckerSoD("teller-a", "teller-a")).toThrow(
      ForbiddenException,
    );
  });

  it("allows different checker", () => {
    expect(() => assertPaymentCheckerSoD("teller-a", "manager-b")).not.toThrow();
  });

  it("rejects double-approve when not PENDING_APPROVAL", () => {
    expect(() =>
      assertPendingApprovalStatus(PaymentOrderStatus.SETTLED),
    ).toThrow(BadRequestException);
    expect(() =>
      assertPendingApprovalStatus(PaymentOrderStatus.PENDING_APPROVAL),
    ).not.toThrow();
  });
});
