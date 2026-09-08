import {
  billingCanonChanged,
  canonMeterUnitPricing,
  canonQuotaUnitPricing,
} from "./billing-meter-canon";

describe("billing meter catalog freeze", () => {
  it("zeros a leftover 0.10 invoice meter", () => {
    const next = canonMeterUnitPricing({
      pricePerUserMonthAzn: 2,
      pricePerGbMonthAzn: 0.5,
      pricePerWhatsappAlertAzn: 0.05,
      pricePerInvoiceAzn: 0.1,
      pricePerOcrPageAzn: 0.02,
    });
    expect(next.pricePerInvoiceAzn).toBe(0);
    expect(next.pricePerOcrPageAzn).toBe(0.02);
  });

  it("rewrites legacy 10 x 15 AZN headcount block to 1 x 2", () => {
    const next = canonQuotaUnitPricing({
      employeeBlockSize: 10,
      pricePerEmployeeBlockAzn: 15,
      documentPackSize: 1000,
      pricePerDocumentPackAzn: 5,
    });
    expect(next.employeeBlockSize).toBe(1);
    expect(next.pricePerEmployeeBlockAzn).toBe(2);
    expect(next.documentPackSize).toBe(1000);
  });

  it("detects a write when invoice meter changes", () => {
    const before = {
      pricePerUserMonthAzn: 2,
      pricePerGbMonthAzn: 0.5,
      pricePerWhatsappAlertAzn: 0.05,
      pricePerInvoiceAzn: 0.1,
      pricePerOcrPageAzn: 0.02,
    };
    const after = canonMeterUnitPricing(before);
    expect(billingCanonChanged(before, after)).toBe(true);
    expect(billingCanonChanged(after, canonMeterUnitPricing(after))).toBe(false);
  });
});
