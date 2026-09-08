/** Catalog freeze: invoices are documents, not a 0.10/invoice meter. */

export type MeterCanonInput = {
  pricePerUserMonthAzn: number;
  pricePerGbMonthAzn: number;
  pricePerWhatsappAlertAzn: number;
  pricePerInvoiceAzn: number;
  pricePerOcrPageAzn: number;
};

export type QuotaCanonInput = {
  employeeBlockSize: number;
  pricePerEmployeeBlockAzn: number;
  documentPackSize: number;
  pricePerDocumentPackAzn: number;
};

export function canonMeterUnitPricing(m: MeterCanonInput): MeterCanonInput {
  return { ...m, pricePerInvoiceAzn: 0 };
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
