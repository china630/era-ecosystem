import type { PublicPricingResponse } from "../public-pricing-types";

const ORCH_API = process.env.NEXT_PUBLIC_ORCH_API_URL ?? "http://127.0.0.1:4000";

export async function fetchPublicPricingSnapshot(): Promise<PublicPricingResponse> {
  try {
    const res = await fetch(`${ORCH_API.replace(/\/$/, "")}/v1/public/pricing`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return unavailablePricingSnapshot();
    return (await res.json()) as PublicPricingResponse;
  } catch {
    return unavailablePricingSnapshot();
  }
}

function unavailablePricingSnapshot(): PublicPricingResponse {
  return {
    currency: "AZN",
    foundationMonthlyAzn: 0,
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
