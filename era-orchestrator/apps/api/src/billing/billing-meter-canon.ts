export type MeterCanonInput = {
  pricePerUserMonthAzn: number;
  pricePerGbMonthAzn: number;
  pricePerWhatsappAlertAzn: number;
  pricePerInvoiceAzn: number;
  pricePerOcrPageAzn: number;
  /** Soft overage for managed trade-credit buyers (~1 AZN). */
  pricePerTradeCreditBuyerAzn?: number;
  /** Soft meter for registry deep-check (~2 AZN). */
  pricePerTradeCreditEnrichAzn?: number;
};

export type QuotaCanonInput = {
  employeeBlockSize: number;
  pricePerEmployeeBlockAzn: number;
  documentPackSize: number;
  pricePerDocumentPackAzn: number;
};

export function canonMeterUnitPricing(
  m: MeterCanonInput,
): MeterCanonInput & {
  pricePerTradeCreditBuyerAzn: number;
  pricePerTradeCreditEnrichAzn: number;
} {
  return {
    ...m,
    pricePerInvoiceAzn: 0,
    pricePerTradeCreditBuyerAzn:
      typeof m.pricePerTradeCreditBuyerAzn === "number" &&
      Number.isFinite(m.pricePerTradeCreditBuyerAzn)
        ? m.pricePerTradeCreditBuyerAzn
        : 1,
    pricePerTradeCreditEnrichAzn:
      typeof m.pricePerTradeCreditEnrichAzn === "number" &&
      Number.isFinite(m.pricePerTradeCreditEnrichAzn)
        ? m.pricePerTradeCreditEnrichAzn
        : 2,
  };
}

export function canonQuotaUnitPricing(q: QuotaCanonInput): QuotaCanonInput {
  const legacyHeadcount = q.employeeBlockSize === 10 && q.pricePerEmployeeBlockAzn === 15;
  return {
    employeeBlockSize: legacyHeadcount ? 1 : q.employeeBlockSize,
    pricePerEmployeeBlockAzn: legacyHeadcount ? 2 : q.pricePerEmployeeBlockAzn,
    documentPackSize: q.documentPackSize >= 100 ? q.documentPackSize : 1000,
    pricePerDocumentPackAzn: q.pricePerDocumentPackAzn > 0 ? q.pricePerDocumentPackAzn : 5,
  };
}

export function billingCanonChanged(
  a: MeterCanonInput | QuotaCanonInput,
  b: MeterCanonInput | QuotaCanonInput,
): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}
