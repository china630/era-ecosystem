/**
 * Public price quote. Same commercial rules as billing:
 * bundle dedup, catalog XOR, clinic room census, capacity overage, workforce headcount.
 * Canon: packages/database/prisma/lib/core/pricing-catalog-canon.ts
 */

import {
  applyCatalogMutex,
  CLINIC_MODULE_CAPACITY,
  clinicCapacityOverage,
  clinicRoomBillableModule,
  inferSatelliteKeyFromModuleKey,
  isOneShotCatalogKey,
  shouldWaiveEraFoundation,
  workforceHeadcountRateAzn,
  WORKFORCE_XOR,
} from "../../../../packages/database/prisma/lib/core/pricing-catalog-canon";

export const OCR_INCLUDED_PAGES = 50;
export const STORAGE_INCLUDED_GB = 20;
export const ERP_LOGINS_INCLUDED = 1;
export const LEGAL_ENTITIES_INCLUDED = 1;
export const LEGAL_ENTITY_MONTHLY_AZN = 19;
export const SMS_PLATFORM_PER_MESSAGE_AZN = 0.01;
export const ACQUIRING_RATE = 0.015;

const WORKFORCE_KEYS = new Set<string>([...WORKFORCE_XOR, "platform_workforce"]);

export type QuoteModule = {
  key: string;
  name: string;
  pricePerMonth: number;
};

export type QuoteBundle = {
  marketingId: string;
  name: string;
  discountPercent: number;
  moduleKeys: string[];
};

export type QuoteCapacityDriver = {
  satelliteKey: string;
  includedInGate: number;
  unitAzn: number;
  unit: string;
};

export type QuoteCatalog = {
  foundationMonthlyAzn: number;
  yearlyDiscountPercent: number;
  modules: QuoteModule[];
  bundles: QuoteBundle[];
  capacityDrivers: QuoteCapacityDriver[];
  meters: {
    pricePerUserMonthAzn: number;
    pricePerGbMonthAzn: number;
    pricePerWhatsappAlertAzn: number;
    pricePerOcrPageAzn: number;
    pricePerTradeCreditBuyerAzn: number;
    pricePerTradeCreditEnrichAzn: number;
    documentPackSize: number;
    pricePerDocumentPackAzn: number;
  };
};

export type CalcState = {
  foundation: boolean;
  kafeWaiver: boolean;
  bundleIds: string[];
  moduleKeys: string[];
  capacity: Record<string, number>;
  clinicRooms: number;
  clinicBeds: number;
  workforceHeadcount: number;
  erpLogins: number;
  legalEntities: number;
  documentsPerMonth: number;
  ocrPages: number;
  storageGb: number;
  whatsappMessages: number;
  smsMessages: number;
  acquiringTurnoverAzn: number;
  tradeCreditBuyers: number;
  tradeCreditEnrich: number;
  yearly: boolean;
};

export type QuoteLineKind =
  | "foundation"
  | "bundle"
  | "module"
  | "capacity"
  | "clinicRooms"
  | "clinicBeds"
  | "workforce"
  | "erpLogins"
  | "legal"
  | "documents"
  | "ocr"
  | "storage"
  | "whatsapp"
  | "sms"
  | "acquiring"
  | "tradeBuyers"
  | "tradeEnrich"
  | "oneShot";

export type QuoteLine = {
  id: string;
  kind: QuoteLineKind;
  group: "subscription" | "capacity" | "people" | "usage" | "once";
  amountAzn: number;
  name?: string;
  key?: string;
  extra?: number;
  unitAzn?: number;
  unit?: string;
  rate?: number;
  headcount?: number;
  listAzn?: number;
};

export type QuoteWarningId =
  | "banking_sandbox"
  | "storage_sku"
  | "whatsapp_sku"
  | "sms_sku"
  | "trade_buyers_sku"
  | "trade_enrich_sku"
  | "workforce_headcount"
  | "clinic_rooms_module"
  | "clinic_beds_module"
  | "catalog_unavailable";

export type QuoteResult = {
  lines: QuoteLine[];
  warnings: QuoteWarningId[];
  activeKeys: string[];
  recurringMonthlyAzn: number;
  usageMonthlyAzn: number;
  oneTimeAzn: number;
  /** Recurring after yearly discount, expressed per month. Usage is not discounted. */
  recurringPerMonthAzn: number;
  monthlyTotalAzn: number;
  yearlySubscriptionAzn: number;
  yearlyDiscountPercent: number;
};

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function emptyCalcState(): CalcState {
  return {
    foundation: true,
    kafeWaiver: false,
    bundleIds: [],
    moduleKeys: [],
    capacity: {},
    clinicRooms: 5,
    clinicBeds: 5,
    workforceHeadcount: 0,
    erpLogins: 1,
    legalEntities: 1,
    documentsPerMonth: 0,
    ocrPages: 0,
    storageGb: 0,
    whatsappMessages: 0,
    smsMessages: 0,
    acquiringTurnoverAzn: 0,
    tradeCreditBuyers: 0,
    tradeCreditEnrich: 0,
    yearly: false,
  };
}

function clampInt(n: unknown, min = 0): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.floor(v));
}

function clampMoney(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return 0;
  return v;
}

export function normalizeCalcState(raw: Partial<CalcState> | null | undefined): CalcState {
  const base = emptyCalcState();
  if (!raw || typeof raw !== "object") return base;
  const moduleKeys = Array.isArray(raw.moduleKeys)
    ? applyCatalogMutex(raw.moduleKeys.map((k) => String(k)))
    : [];
  const bundleIds = Array.isArray(raw.bundleIds)
    ? [...new Set(raw.bundleIds.map((k) => String(k)).filter(Boolean))]
    : [];
  const capacity: Record<string, number> = {};
  if (raw.capacity && typeof raw.capacity === "object") {
    for (const [k, v] of Object.entries(raw.capacity)) {
      capacity[k] = clampInt(v);
    }
  }
  return {
    foundation: raw.foundation !== false,
    kafeWaiver: raw.kafeWaiver === true,
    bundleIds,
    moduleKeys,
    capacity,
    clinicRooms: clampInt(raw.clinicRooms ?? base.clinicRooms),
    clinicBeds: clampInt(raw.clinicBeds ?? base.clinicBeds),
    workforceHeadcount: clampInt(raw.workforceHeadcount),
    erpLogins: clampInt(raw.erpLogins ?? base.erpLogins),
    legalEntities: clampInt(raw.legalEntities ?? base.legalEntities),
    documentsPerMonth: clampInt(raw.documentsPerMonth),
    ocrPages: clampInt(raw.ocrPages),
    storageGb: clampInt(raw.storageGb),
    whatsappMessages: clampInt(raw.whatsappMessages),
    smsMessages: clampInt(raw.smsMessages),
    acquiringTurnoverAzn: clampMoney(raw.acquiringTurnoverAzn),
    tradeCreditBuyers: clampInt(raw.tradeCreditBuyers),
    tradeCreditEnrich: clampInt(raw.tradeCreditEnrich),
    yearly: raw.yearly === true,
  };
}

function priceOf(byKey: Map<string, QuoteModule>, key: string): number {
  return byKey.get(key)?.pricePerMonth ?? 0;
}

function bundleAmount(
  keys: string[],
  discountPercent: number,
  byKey: Map<string, QuoteModule>,
): number {
  const list = keys.reduce((s, k) => s + priceOf(byKey, k), 0);
  return roundMoney2(list * (1 - discountPercent / 100));
}

export function quoteMonthly(catalog: QuoteCatalog, raw: Partial<CalcState>): QuoteResult {
  const state = normalizeCalcState(raw);
  const byKey = new Map(catalog.modules.map((m) => [m.key, m]));
  const warnings: QuoteWarningId[] = [];
  const lines: QuoteLine[] = [];

  const selected = new Set(state.moduleKeys);
  for (const id of state.bundleIds) {
    const bundle = catalog.bundles.find((b) => b.marketingId === id);
    if (!bundle) continue;
    for (const k of bundle.moduleKeys) selected.add(k);
  }

  for (const key of [...selected]) {
    const gate = inferSatelliteKeyFromModuleKey(key);
    if (gate && !selected.has(gate) && byKey.has(gate)) selected.add(gate);
  }

  const activeKeys = applyCatalogMutex([...selected]);

  let foundationAzn = 0;
  const nasForcesFoundation = activeKeys.includes("nas") || activeKeys.includes("industry_finance");
  if (state.foundation || nasForcesFoundation) {
    const waive =
      !nasForcesFoundation &&
      state.kafeWaiver &&
      shouldWaiveEraFoundation({
        settings: { edition: "kafe", signupSource: "kafe" },
        activeModules: activeKeys,
      });
    foundationAzn = waive ? 0 : catalog.foundationMonthlyAzn;
    if (foundationAzn > 0) {
      lines.push({
        id: "foundation",
        kind: "foundation",
        group: "subscription",
        amountAzn: roundMoney2(foundationAzn),
      });
    }
  }

  const claimed = new Set<string>();
  for (const id of state.bundleIds) {
    const bundle = catalog.bundles.find((b) => b.marketingId === id);
    if (!bundle) continue;
    const billable = bundle.moduleKeys.filter((k) => !claimed.has(k) && !isOneShotCatalogKey(k));
    if (billable.length === 0) continue;
    for (const k of billable) claimed.add(k);
    const listAzn = roundMoney2(billable.reduce((s, k) => s + priceOf(byKey, k), 0));
    const amountAzn = bundleAmount(billable, bundle.discountPercent, byKey);
    if (amountAzn <= 0 && listAzn <= 0) continue;
    lines.push({
      id: `bundle:${bundle.marketingId}`,
      kind: "bundle",
      group: "subscription",
      amountAzn,
      name: bundle.name,
      listAzn,
      key: bundle.marketingId,
    });
  }

  for (const key of activeKeys) {
    if (claimed.has(key)) continue;
    if (isOneShotCatalogKey(key)) continue;
    const mod = byKey.get(key);
    if (!mod) continue;
    const price = roundMoney2(mod.pricePerMonth);
    if (WORKFORCE_KEYS.has(key)) {
      if (price <= 0) continue;
    }
    if (price <= 0) continue;
    lines.push({
      id: `module:${key}`,
      kind: "module",
      group: "subscription",
      amountAzn: price,
      name: mod.name,
      key,
    });
    claimed.add(key);
  }

  for (const key of activeKeys) {
    if (!isOneShotCatalogKey(key)) continue;
    const mod = byKey.get(key);
    if (!mod || mod.pricePerMonth <= 0) continue;
    lines.push({
      id: `once:${key}`,
      kind: "oneShot",
      group: "once",
      amountAzn: roundMoney2(mod.pricePerMonth),
      name: mod.name,
      key,
    });
  }

  const gateOn = (satelliteKey: string) => activeKeys.includes(satelliteKey);

  for (const driver of catalog.capacityDrivers) {
    if (!gateOn(driver.satelliteKey)) continue;
    const count = clampInt(state.capacity[driver.satelliteKey] ?? driver.includedInGate);
    const extra = Math.max(0, count - driver.includedInGate);
    const amountAzn = roundMoney2(extra * driver.unitAzn);
    if (amountAzn <= 0) continue;
    lines.push({
      id: `cap:${driver.satelliteKey}`,
      kind: "capacity",
      group: "capacity",
      amountAzn,
      key: driver.satelliteKey,
      extra,
      unitAzn: driver.unitAzn,
      unit: driver.unit,
    });
  }

  const roomModule = clinicRoomBillableModule(activeKeys);
  if (roomModule) {
    const def = CLINIC_MODULE_CAPACITY.find((d) => d.moduleKey === roomModule);
    const included = def?.included ?? 5;
    const unitAzn = def?.unitAzn ?? 19;
    const extra = clinicCapacityOverage(state.clinicRooms, included);
    const amountAzn = roundMoney2(extra * unitAzn);
    if (amountAzn > 0) {
      lines.push({
        id: "clinic-rooms",
        kind: "clinicRooms",
        group: "capacity",
        amountAzn,
        key: roomModule,
        extra,
        unitAzn,
      });
    }
  } else if (state.clinicRooms > 5 && activeKeys.includes("industry_clinic")) {
    warnings.push("clinic_rooms_module");
  }

  if (activeKeys.includes("clinic_inpatient")) {
    const def = CLINIC_MODULE_CAPACITY.find((d) => d.moduleKey === "clinic_inpatient");
    const included = def?.included ?? 5;
    const unitAzn = def?.unitAzn ?? 19;
    const extra = clinicCapacityOverage(state.clinicBeds, included);
    const amountAzn = roundMoney2(extra * unitAzn);
    if (amountAzn > 0) {
      lines.push({
        id: "clinic-beds",
        kind: "clinicBeds",
        group: "capacity",
        amountAzn,
        extra,
        unitAzn,
      });
    }
  } else if (state.clinicBeds > 5 && (activeKeys.includes("industry_clinic") || activeKeys.includes("clinic_inpatient"))) {
    warnings.push("clinic_beds_module");
  }

  const headcountRate = workforceHeadcountRateAzn(activeKeys);
  if (headcountRate > 0 && state.workforceHeadcount > 0) {
    lines.push({
      id: "workforce",
      kind: "workforce",
      group: "people",
      amountAzn: roundMoney2(state.workforceHeadcount * headcountRate),
      headcount: state.workforceHeadcount,
      rate: headcountRate,
    });
  } else if (headcountRate > 0 && state.workforceHeadcount === 0) {
    warnings.push("workforce_headcount");
  }

  const erpIncluded = foundationAzn > 0 ? ERP_LOGINS_INCLUDED : 0;
  const erpExtra = Math.max(0, state.erpLogins - erpIncluded);
  if (erpExtra > 0 && catalog.meters.pricePerUserMonthAzn > 0) {
    lines.push({
      id: "erp-logins",
      kind: "erpLogins",
      group: "people",
      amountAzn: roundMoney2(erpExtra * catalog.meters.pricePerUserMonthAzn),
      extra: erpExtra,
      unitAzn: catalog.meters.pricePerUserMonthAzn,
    });
  }

  const legalExtra = Math.max(0, state.legalEntities - LEGAL_ENTITIES_INCLUDED);
  if (legalExtra > 0) {
    lines.push({
      id: "legal",
      kind: "legal",
      group: "people",
      amountAzn: roundMoney2(legalExtra * LEGAL_ENTITY_MONTHLY_AZN),
      extra: legalExtra,
      unitAzn: LEGAL_ENTITY_MONTHLY_AZN,
    });
  }

  const docIncluded = foundationAzn > 0 ? catalog.meters.documentPackSize : 0;
  const docOver = Math.max(0, state.documentsPerMonth - docIncluded);
  if (docOver > 0 && catalog.meters.documentPackSize > 0 && catalog.meters.pricePerDocumentPackAzn > 0) {
    const packs = Math.ceil(docOver / catalog.meters.documentPackSize);
    lines.push({
      id: "documents",
      kind: "documents",
      group: "usage",
      amountAzn: roundMoney2(packs * catalog.meters.pricePerDocumentPackAzn),
      extra: packs,
      unitAzn: catalog.meters.pricePerDocumentPackAzn,
    });
  }

  const ocrIncluded = foundationAzn > 0 ? OCR_INCLUDED_PAGES : 0;
  const ocrExtra = Math.max(0, state.ocrPages - ocrIncluded);
  if (ocrExtra > 0 && catalog.meters.pricePerOcrPageAzn > 0) {
    lines.push({
      id: "ocr",
      kind: "ocr",
      group: "usage",
      amountAzn: roundMoney2(ocrExtra * catalog.meters.pricePerOcrPageAzn),
      extra: ocrExtra,
      unitAzn: catalog.meters.pricePerOcrPageAzn,
    });
  }

  if (state.storageGb > 0) {
    if (!activeKeys.includes("platform_storage")) {
      warnings.push("storage_sku");
    } else {
      const extraGb = Math.max(0, state.storageGb - STORAGE_INCLUDED_GB);
      if (extraGb > 0 && catalog.meters.pricePerGbMonthAzn > 0) {
        lines.push({
          id: "storage",
          kind: "storage",
          group: "usage",
          amountAzn: roundMoney2(extraGb * catalog.meters.pricePerGbMonthAzn),
          extra: extraGb,
          unitAzn: catalog.meters.pricePerGbMonthAzn,
        });
      }
    }
  }

  if (state.whatsappMessages > 0) {
    if (!activeKeys.includes("platform_notifications")) warnings.push("whatsapp_sku");
    if (catalog.meters.pricePerWhatsappAlertAzn > 0) {
      lines.push({
        id: "whatsapp",
        kind: "whatsapp",
        group: "usage",
        amountAzn: roundMoney2(state.whatsappMessages * catalog.meters.pricePerWhatsappAlertAzn),
        extra: state.whatsappMessages,
        unitAzn: catalog.meters.pricePerWhatsappAlertAzn,
      });
    }
  }

  if (state.smsMessages > 0) {
    if (!activeKeys.includes("platform_notifications") && !activeKeys.includes("platform_notifications_sms")) {
      warnings.push("sms_sku");
    }
    lines.push({
      id: "sms",
      kind: "sms",
      group: "usage",
      amountAzn: roundMoney2(state.smsMessages * SMS_PLATFORM_PER_MESSAGE_AZN),
      extra: state.smsMessages,
      unitAzn: SMS_PLATFORM_PER_MESSAGE_AZN,
    });
  }

  if (state.acquiringTurnoverAzn > 0) {
    lines.push({
      id: "acquiring",
      kind: "acquiring",
      group: "usage",
      amountAzn: roundMoney2(state.acquiringTurnoverAzn * ACQUIRING_RATE),
    });
  }

  if (state.tradeCreditBuyers > 0) {
    if (!activeKeys.includes("trade_credit_control")) warnings.push("trade_buyers_sku");
    if (catalog.meters.pricePerTradeCreditBuyerAzn > 0) {
      lines.push({
        id: "trade-buyers",
        kind: "tradeBuyers",
        group: "usage",
        amountAzn: roundMoney2(state.tradeCreditBuyers * catalog.meters.pricePerTradeCreditBuyerAzn),
        extra: state.tradeCreditBuyers,
        unitAzn: catalog.meters.pricePerTradeCreditBuyerAzn,
      });
    }
  }

  if (state.tradeCreditEnrich > 0) {
    if (!activeKeys.includes("trade_credit_factor_lead")) warnings.push("trade_enrich_sku");
    if (catalog.meters.pricePerTradeCreditEnrichAzn > 0) {
      lines.push({
        id: "trade-enrich",
        kind: "tradeEnrich",
        group: "usage",
        amountAzn: roundMoney2(state.tradeCreditEnrich * catalog.meters.pricePerTradeCreditEnrichAzn),
        extra: state.tradeCreditEnrich,
        unitAzn: catalog.meters.pricePerTradeCreditEnrichAzn,
      });
    }
  }

  if (activeKeys.includes("industry_banking")) warnings.push("banking_sandbox");

  const sum = (group: QuoteLine["group"]) =>
    roundMoney2(lines.filter((l) => l.group === group).reduce((s, l) => s + l.amountAzn, 0));

  const recurringMonthlyAzn = roundMoney2(sum("subscription") + sum("capacity") + sum("people"));
  const usageMonthlyAzn = sum("usage");
  const oneTimeAzn = sum("once");
  const discount = Math.min(100, Math.max(0, catalog.yearlyDiscountPercent));
  const yearlyFactor = state.yearly ? 1 - discount / 100 : 1;
  const yearlySubscriptionAzn = roundMoney2(recurringMonthlyAzn * 12 * yearlyFactor);
  const recurringPerMonthAzn = state.yearly
    ? roundMoney2(yearlySubscriptionAzn / 12)
    : recurringMonthlyAzn;
  const monthlyTotalAzn = roundMoney2(recurringPerMonthAzn + usageMonthlyAzn);

  return {
    lines,
    warnings,
    activeKeys,
    recurringMonthlyAzn,
    usageMonthlyAzn,
    oneTimeAzn,
    recurringPerMonthAzn,
    monthlyTotalAzn,
    yearlySubscriptionAzn,
    yearlyDiscountPercent: state.yearly ? discount : 0,
  };
}
