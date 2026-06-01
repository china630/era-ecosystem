/** Hospitality storefront registry — satellite gate + hotel submodules (not platform add-ons). */

export type PricingHospitalityModuleDef = {
  id: string;
  moduleKeys: readonly string[];
  /** Industry satellite gate vs submodule */
  isSatelliteGate?: boolean;
};

export const PRICING_HOSPITALITY_MODULE_REGISTRY: readonly PricingHospitalityModuleDef[] = [
  { id: "hotel_pms_gate", moduleKeys: ["industry_hotel_pms"], isSatelliteGate: true },
  { id: "hotel_core", moduleKeys: ["hotel_core"] },
  { id: "hotel_housekeeping", moduleKeys: ["hotel_housekeeping"] },
  { id: "hotel_distribution", moduleKeys: ["hotel_distribution"] },
  { id: "hotel_guest_experience", moduleKeys: ["hotel_guest_experience"] },
  { id: "hotel_spa_scheduling", moduleKeys: ["hotel_spa_scheduling"] },
  { id: "hotel_transfers", moduleKeys: ["hotel_transfers"] },
  { id: "hotel_banquets", moduleKeys: ["hotel_banquets"] },
  { id: "hotel_medical_sanatorium", moduleKeys: ["hotel_medical_sanatorium"] },
  { id: "hotel_setup_advanced", moduleKeys: ["hotel_setup_advanced"] },
] as const;

export const PRICING_HOSPITALITY_BUNDLE_MARKETING: readonly {
  matchModuleKeys: readonly string[];
  marketingId: string;
}[] = [
  {
    marketingId: "hotel_city",
    matchModuleKeys: ["hotel_core", "hotel_housekeeping"],
  },
  {
    marketingId: "hotel_resort",
    matchModuleKeys: [
      "hotel_core",
      "hotel_housekeeping",
      "hotel_distribution",
      "hotel_guest_experience",
      "hotel_transfers",
      "hotel_banquets",
      "hotel_spa_scheduling",
    ],
  },
  {
    marketingId: "hotel_sanatorium",
    matchModuleKeys: [
      "hotel_core",
      "hotel_housekeeping",
      "hotel_distribution",
      "hotel_guest_experience",
      "hotel_transfers",
      "hotel_banquets",
      "hotel_spa_scheduling",
      "hotel_medical_sanatorium",
    ],
  },
];
