import type { PublicPricingResponse } from "../public-pricing-types";
import {
  applyCatalogMutex,
  inferSatelliteKeyFromModuleKey,
} from "../../../../packages/database/prisma/lib/core/pricing-catalog-canon";
import {
  emptyCalcState,
  normalizeCalcState,
  type CalcState,
  type QuoteBundle,
  type QuoteCatalog,
} from "./quote-calculator";

export type PresetId =
  | "core"
  | "hotel_city"
  | "hotel_resort"
  | "sanatorium"
  | "clinic"
  | "kafe"
  | "retail";

const HOTEL_CITY = ["hotel_core", "hotel_housekeeping", "hotel_migration_pro", "hotel_distribution"];
const HOTEL_RESORT = [
  ...HOTEL_CITY,
  "hotel_guest_experience",
  "hotel_transfers",
  "hotel_banquets",
  "hotel_spa_scheduling",
];
const HOTEL_SANATORIUM = [...HOTEL_RESORT, "hotel_medical_sanatorium"];

export function bundleSatelliteKey(keys: readonly string[]): string | null {
  for (const k of keys) {
    const gate = inferSatelliteKeyFromModuleKey(k);
    if (gate) return gate;
    if (k.startsWith("industry_")) return k;
  }
  return null;
}

export function catalogFromSnapshot(snapshot: PublicPricingResponse): QuoteCatalog {
  const bundles: QuoteBundle[] = [];
  const seenSig = new Set<string>();
  const add = (marketingId: string, name: string, discountPercent: number, moduleKeys: string[]) => {
    const signature = [...moduleKeys].sort().join(",");
    if (!signature || seenSig.has(signature)) return;
    seenSig.add(signature);
    bundles.push({ marketingId, name, discountPercent, moduleKeys });
  };
  for (const b of [...(snapshot.bundles ?? []), ...(snapshot.hospitalityBundles ?? [])]) {
    add(b.marketingId, b.name, b.discountPercent, b.moduleKeys);
  }
  for (const g of snapshot.industryGroups ?? []) {
    for (const b of g.bundles) add(b.marketingId, b.name, b.discountPercent, b.moduleKeys);
  }
  for (const b of snapshot.pricingBundles ?? []) {
    if (b.isTrialDefault || b.discountPercent >= 100) continue;
    add(`keys:${[...b.moduleKeys].sort().join(",")}`, b.name, b.discountPercent, b.moduleKeys);
  }

  const capacityDrivers = (snapshot.industryGroups ?? [])
    .filter((g) => g.capacity)
    .map((g) => ({
      satelliteKey: g.satelliteKey,
      includedInGate: g.capacity!.includedInGate,
      unitAzn: g.capacity!.unitAzn,
      unit: g.capacity!.unit,
    }));

  const quota = snapshot.quotaUnitPricing;
  return {
    foundationMonthlyAzn: snapshot.foundationMonthlyAzn,
    yearlyDiscountPercent: snapshot.yearlyDiscountPercent ?? 0,
    modules: (snapshot.pricingModules ?? []).map((m) => ({
      key: m.key,
      name: m.name,
      pricePerMonth: m.pricePerMonth,
    })),
    bundles,
    capacityDrivers,
    meters: {
      pricePerUserMonthAzn: snapshot.meterUnitPricing?.pricePerUserMonthAzn ?? 2,
      pricePerGbMonthAzn: snapshot.meterUnitPricing?.pricePerGbMonthAzn ?? 0.5,
      pricePerWhatsappAlertAzn: snapshot.meterUnitPricing?.pricePerWhatsappAlertAzn ?? 0.05,
      pricePerOcrPageAzn: snapshot.meterUnitPricing?.pricePerOcrPageAzn ?? 0.02,
      pricePerTradeCreditBuyerAzn: snapshot.meterUnitPricing?.pricePerTradeCreditBuyerAzn ?? 0,
      pricePerTradeCreditEnrichAzn: snapshot.meterUnitPricing?.pricePerTradeCreditEnrichAzn ?? 0,
      documentPackSize: quota?.documentPackSize ?? 1000,
      pricePerDocumentPackAzn: quota?.pricePerDocumentPackAzn ?? 5,
    },
  };
}

function sig(keys: readonly string[]): string {
  return [...keys].sort().join(",");
}

function findBundle(catalog: QuoteCatalog, keys: string[]): QuoteBundle | null {
  const want = sig(keys);
  return catalog.bundles.find((b) => sig(b.moduleKeys) === want) ?? null;
}

function withCapacity(state: CalcState, catalog: QuoteCatalog, satelliteKey: string): CalcState {
  const driver = catalog.capacityDrivers.find((d) => d.satelliteKey === satelliteKey);
  if (!driver || state.capacity[satelliteKey] != null) return state;
  return { ...state, capacity: { ...state.capacity, [satelliteKey]: driver.includedInGate } };
}

function enableSatellite(state: CalcState, catalog: QuoteCatalog, satelliteKey: string, extraKeys: string[], bundleKeys: string[] | null): CalcState {
  let next = withCapacity(state, catalog, satelliteKey);
  const bundle = bundleKeys ? findBundle(catalog, bundleKeys) : null;
  const bundleIds = bundle
    ? [...next.bundleIds.filter((id) => {
        const b = catalog.bundles.find((x) => x.marketingId === id);
        return b ? bundleSatelliteKey(b.moduleKeys) !== satelliteKey : true;
      }), bundle.marketingId]
    : next.bundleIds;
  const covered = new Set(bundle?.moduleKeys ?? []);
  const moduleKeys = applyCatalogMutex([
    ...next.moduleKeys.filter((k) => inferSatelliteKeyFromModuleKey(k) !== satelliteKey && k !== satelliteKey),
    satelliteKey,
    ...extraKeys.filter((k) => !covered.has(k)),
    ...(bundle ? [] : (bundleKeys ?? []).filter((k) => catalog.modules.some((m) => m.key === k))),
  ]);
  return { ...next, foundation: true, kafeWaiver: false, bundleIds, moduleKeys };
}

export function applyPreset(id: PresetId, catalog: QuoteCatalog): CalcState {
  const base = emptyCalcState();
  if (id === "core") return base;
  if (id === "kafe") {
    return {
      ...base,
      foundation: false,
      kafeWaiver: true,
      erpLogins: 0,
      moduleKeys: ["industry_fnb_pos"],
      capacity: { industry_fnb_pos: catalog.capacityDrivers.find((d) => d.satelliteKey === "industry_fnb_pos")?.includedInGate ?? 1 },
    };
  }
  if (id === "hotel_city") return enableSatellite(base, catalog, "industry_hotel_pms", [], HOTEL_CITY);
  if (id === "hotel_resort") return enableSatellite(base, catalog, "industry_hotel_pms", [], HOTEL_RESORT);
  if (id === "retail") return enableSatellite(base, catalog, "industry_retail", [], null);
  if (id === "clinic") return enableSatellite(base, catalog, "industry_clinic", ["clinic_registry_emr"], null);
  if (id === "sanatorium") {
    const hotel = enableSatellite(base, catalog, "industry_hotel_pms", [], HOTEL_SANATORIUM);
    return enableSatellite(hotel, catalog, "industry_clinic", ["clinic_sanatorium"], null);
  }
  return base;
}

export function toggleModule(state: CalcState, key: string, catalog: QuoteCatalog): CalcState {
  const on = state.moduleKeys.includes(key);
  if (!on) {
    let keys = applyCatalogMutex([...state.moduleKeys, key], key);
    const gate = inferSatelliteKeyFromModuleKey(key);
    if (gate) keys = applyCatalogMutex([...keys, gate], key);
    let capacity = state.capacity;
    if (key.startsWith("industry_")) {
      const driver = catalog.capacityDrivers.find((d) => d.satelliteKey === key);
      if (driver && capacity[key] == null) capacity = { ...capacity, [key]: driver.includedInGate };
    }
    if (gate) {
      const driver = catalog.capacityDrivers.find((d) => d.satelliteKey === gate);
      if (driver && capacity[gate] == null) capacity = { ...capacity, [gate]: driver.includedInGate };
    }
    return { ...state, moduleKeys: keys, capacity };
  }

  let keys = state.moduleKeys.filter((k) => k !== key);
  let bundleIds = state.bundleIds;
  if (key.startsWith("industry_")) {
    keys = keys.filter((k) => inferSatelliteKeyFromModuleKey(k) !== key);
    bundleIds = bundleIds.filter((id) => {
      const b = catalog.bundles.find((x) => x.marketingId === id);
      return b ? bundleSatelliteKey(b.moduleKeys) !== key : true;
    });
  }
  return { ...state, moduleKeys: applyCatalogMutex(keys), bundleIds };
}

export function toggleBundle(state: CalcState, marketingId: string, catalog: QuoteCatalog): CalcState {
  const bundle = catalog.bundles.find((b) => b.marketingId === marketingId);
  if (!bundle) return state;
  const satellite = bundleSatelliteKey(bundle.moduleKeys);
  if (state.bundleIds.includes(marketingId)) {
    return { ...state, bundleIds: state.bundleIds.filter((id) => id !== marketingId) };
  }
  const bundleIds = [
    ...state.bundleIds.filter((id) => {
      const other = catalog.bundles.find((b) => b.marketingId === id);
      if (!other) return false;
      return bundleSatelliteKey(other.moduleKeys) !== satellite;
    }),
    marketingId,
  ];
  let moduleKeys = state.moduleKeys.filter((k) => !bundle.moduleKeys.includes(k));
  let capacity = state.capacity;
  if (satellite) {
    moduleKeys = applyCatalogMutex([...moduleKeys, satellite]);
    const driver = catalog.capacityDrivers.find((d) => d.satelliteKey === satellite);
    if (driver && capacity[satellite] == null) capacity = { ...capacity, [satellite]: driver.includedInGate };
  }
  return { ...state, bundleIds, moduleKeys, capacity };
}

const WORKFORCE_SLUG = {
  1: "platform_workforce_base",
  2: "platform_workforce_pro",
  3: "platform_workforce_premium",
} as const;

export function setWorkforcePackage(state: CalcState, rank: 0 | 1 | 2 | 3): CalcState {
  const stripped = state.moduleKeys.filter(
    (k) =>
      k !== "platform_workforce" &&
      k !== "platform_workforce_base" &&
      k !== "platform_workforce_pro" &&
      k !== "platform_workforce_premium",
  );
  if (rank === 0) return { ...state, moduleKeys: stripped, workforceHeadcount: 0 };
  const slug = WORKFORCE_SLUG[rank];
  return { ...state, moduleKeys: applyCatalogMutex([...stripped, slug], slug) };
}

export function serializeCalcState(state: CalcState): string {
  return JSON.stringify(state);
}

export function parseCalcState(raw: string): CalcState | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CalcState>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return normalizeCalcState(parsed);
  } catch {
    return null;
  }
}
