import type { PublicPricingResponse } from "../public-pricing-types";

function orchApiBase(): string {
  return (process.env.ORCH_API_INTERNAL_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
}

export async function fetchPublicPricingSnapshot(): Promise<PublicPricingResponse> {
  const url =
    typeof window === "undefined"
      ? `${orchApiBase()}/v1/public/pricing`
      : "/api/public/pricing";
  try {
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return unavailablePricingSnapshot();
    const body = (await res.json()) as PublicPricingResponse;
    if (body.unavailable) return { ...unavailablePricingSnapshot(), ...body, unavailable: true };
    return body;
  } catch {
    return unavailablePricingSnapshot();
  }
}

function unavailablePricingSnapshot(): PublicPricingResponse {
  return {
    currency: "AZN",
    foundationMonthlyAzn: 29,
    yearlyDiscountPercent: 0,
    pricingModules: [],
    pricingBundles: [],
    meterUnitPricing: {
      pricePerUserMonthAzn: 2,
      pricePerGbMonthAzn: 0.5,
      pricePerWhatsappAlertAzn: 0.05,
      pricePerInvoiceAzn: 0,
      pricePerOcrPageAzn: 0.02,
    },
    quotaUnitPricing: {
      employeeBlockSize: 1,
      pricePerEmployeeBlockAzn: 2,
      documentPackSize: 1000,
      pricePerDocumentPackAzn: 5,
    },
    tierSpendCeilings: {},
    unavailable: true,
  };
}
