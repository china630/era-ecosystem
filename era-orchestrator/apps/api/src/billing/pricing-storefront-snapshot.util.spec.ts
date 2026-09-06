import { enrichPublicPricingStorefront } from "../billing/pricing-storefront-snapshot.util";

describe("enrichPublicPricingStorefront catalog freeze", () => {
  const hotelModules = [
    { key: "industry_hotel_pms", name: "Hotel PMS", pricePerMonth: 29, sortOrder: 100, isPremium: false, satelliteKey: null },
    { key: "hotel_core", name: "Core", pricePerMonth: 29, sortOrder: 110, isPremium: false, satelliteKey: "industry_hotel_pms" },
    { key: "hotel_housekeeping", name: "HK", pricePerMonth: 19, sortOrder: 111, isPremium: false, satelliteKey: "industry_hotel_pms" },
    { key: "hotel_migration_pro", name: "Migration", pricePerMonth: 39, sortOrder: 112, isPremium: true, satelliteKey: "industry_hotel_pms" },
    { key: "hotel_distribution", name: "Distribution", pricePerMonth: 29, sortOrder: 113, isPremium: false, satelliteKey: "industry_hotel_pms" },
    { key: "hotel_guest_experience", name: "Guest", pricePerMonth: 29, sortOrder: 114, isPremium: false, satelliteKey: "industry_hotel_pms" },
    { key: "hotel_spa_scheduling", name: "SPA", pricePerMonth: 29, sortOrder: 115, isPremium: false, satelliteKey: "industry_hotel_pms" },
    { key: "hotel_banquets", name: "Banquets", pricePerMonth: 29, sortOrder: 116, isPremium: false, satelliteKey: "industry_hotel_pms" },
    { key: "hotel_transfers", name: "Transfers", pricePerMonth: 19, sortOrder: 117, isPremium: false, satelliteKey: "industry_hotel_pms" },
    { key: "hotel_medical_sanatorium", name: "Sanatorium", pricePerMonth: 29, sortOrder: 118, isPremium: false, satelliteKey: "industry_hotel_pms" },
  ];

  const clinicModules = [
    { key: "industry_clinic", name: "Clinic", pricePerMonth: 29, sortOrder: 107, isPremium: false, satelliteKey: null },
    { key: "clinic_patients", name: "Patients", pricePerMonth: 0, sortOrder: 201, isPremium: false, satelliteKey: "industry_clinic" },
    { key: "clinic_registry_emr", name: "EMR", pricePerMonth: 29, sortOrder: 216, isPremium: false, satelliteKey: "industry_clinic" },
    { key: "clinic_lab", name: "Lab", pricePerMonth: 29, sortOrder: 205, isPremium: false, satelliteKey: "industry_clinic" },
  ];

  const premiumFinance = [
    { key: "tax_pro", name: "Tax Pro", pricePerMonth: 39, sortOrder: 10, isPremium: true, satelliteKey: null },
  ];

  it("maps Hotel Resort to marketing id and keeps hotel bundles off the finance shelf", () => {
    const out = enrichPublicPricingStorefront({
      foundationMonthlyAzn: 29,
      pricingModules: [...hotelModules, ...premiumFinance],
      pricingBundles: [
        {
          name: "Hotel Resort",
          discountPercent: 15,
          moduleKeys: [
            "hotel_core",
            "hotel_housekeeping",
            "hotel_migration_pro",
            "hotel_distribution",
            "hotel_guest_experience",
            "hotel_transfers",
            "hotel_banquets",
            "hotel_spa_scheduling",
          ],
          isTrialDefault: false,
          trialDurationDays: null,
        },
        {
          name: "Cash & warehouse",
          discountPercent: 15,
          moduleKeys: ["cash_bank_pro", "inventory"],
          isTrialDefault: false,
          trialDurationDays: null,
        },
      ],
      tierSpendCeilingsAzn: {},
      meterUnitPricing: {
        pricePerUserMonthAzn: 2,
        pricePerGbMonthAzn: 0.5,
        pricePerWhatsappAlertAzn: 0.05,
        pricePerInvoiceAzn: 0,
        pricePerOcrPageAzn: 0.02,
      },
    });

    const resort = out.hospitalityBundles.find((b) => b.marketingId === "hotel_resort");
    expect(resort).toBeDefined();
    expect(resort?.discountedPriceAzn).toBe(188.7);
    expect(out.bundles.every((b) => b.marketingId !== "hotel_resort")).toBe(true);
    expect(out.premiumModules.map((m) => m.key)).toEqual(["tax_pro"]);
  });

  it("hides zero-price clinic grants and keeps EMR/lab as paid SKUs", () => {
    const out = enrichPublicPricingStorefront({
      foundationMonthlyAzn: 29,
      pricingModules: clinicModules,
      pricingBundles: [],
      tierSpendCeilingsAzn: {},
      meterUnitPricing: {
        pricePerUserMonthAzn: 2,
        pricePerGbMonthAzn: 0.5,
        pricePerWhatsappAlertAzn: 0.05,
        pricePerInvoiceAzn: 0,
        pricePerOcrPageAzn: 0.02,
      },
    });
    const clinic = out.industryGroups.find((g) => g.satelliteKey === "industry_clinic");
    expect(clinic?.gate?.pricePerMonth).toBe(29);
    expect(clinic?.modules.map((m) => m.key).sort()).toEqual(["clinic_lab", "clinic_registry_emr"]);
  });
});
