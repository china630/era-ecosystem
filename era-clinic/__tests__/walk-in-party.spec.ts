import { guestPlaceholderName, isGuestPlaceholder, nextPartyStatus } from "@/domain/sanatorium/walk-in-party";

describe("walk-in party status", () => {
  it("stays a draft until a receipt exists", () => {
    expect(nextPartyStatus({ receiptRef: null, unpaidCount: 2 })).toBe("DRAFT");
  });

  it("is at the cashier while any priced line is unpaid", () => {
    expect(nextPartyStatus({ receiptRef: "20261022-001", unpaidCount: 1 })).toBe("SENT_TO_CASHIER");
  });

  it("is paid only when the receipt exists and nothing is unpaid", () => {
    expect(nextPartyStatus({ receiptRef: "20261022-001", unpaidCount: 0 })).toBe("PAID");
  });

  it("treats Guest N as a placeholder for that row only", () => {
    expect(guestPlaceholderName(2)).toBe("Guest 2");
    expect(isGuestPlaceholder("Guest 2", 2)).toBe(true);
    expect(isGuestPlaceholder("Guest 2", 3)).toBe(false);
    expect(isGuestPlaceholder("Li Wei", 2)).toBe(false);
  });
});
