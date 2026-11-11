"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACQUIRING_RATE = exports.SMS_PLATFORM_PER_MESSAGE_AZN = exports.LEGAL_ENTITY_MONTHLY_AZN = exports.LEGAL_ENTITIES_INCLUDED = exports.ERP_LOGINS_INCLUDED = exports.STORAGE_INCLUDED_GB = exports.OCR_INCLUDED_PAGES = void 0;
exports.roundMoney2 = roundMoney2;
exports.emptyCalcState = emptyCalcState;
exports.normalizeCalcState = normalizeCalcState;
exports.quoteMonthly = quoteMonthly;
const pricing_catalog_canon_1 = require("../../../../packages/database/prisma/lib/core/pricing-catalog-canon");
exports.OCR_INCLUDED_PAGES = 50;
exports.STORAGE_INCLUDED_GB = 20;
exports.ERP_LOGINS_INCLUDED = 1;
exports.LEGAL_ENTITIES_INCLUDED = 1;
exports.LEGAL_ENTITY_MONTHLY_AZN = 19;
exports.SMS_PLATFORM_PER_MESSAGE_AZN = 0.01;
exports.ACQUIRING_RATE = 0.015;
const WORKFORCE_KEYS = new Set([...pricing_catalog_canon_1.WORKFORCE_XOR, "platform_workforce"]);
function roundMoney2(n) {
    return Math.round(n * 100) / 100;
}
function emptyCalcState() {
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
function clampInt(n, min = 0) {
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v))
        return min;
    return Math.max(min, Math.floor(v));
}
function clampMoney(n) {
    const v = typeof n === "number" ? n : Number(n);
    if (!Number.isFinite(v) || v < 0)
        return 0;
    return v;
}
function normalizeCalcState(raw) {
    const base = emptyCalcState();
    if (!raw || typeof raw !== "object")
        return base;
    const moduleKeys = Array.isArray(raw.moduleKeys)
        ? (0, pricing_catalog_canon_1.applyCatalogMutex)(raw.moduleKeys.map((k) => String(k)))
        : [];
    const bundleIds = Array.isArray(raw.bundleIds)
        ? [...new Set(raw.bundleIds.map((k) => String(k)).filter(Boolean))]
        : [];
    const capacity = {};
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
function priceOf(byKey, key) {
    return byKey.get(key)?.pricePerMonth ?? 0;
}
function bundleAmount(keys, discountPercent, byKey) {
    const list = keys.reduce((s, k) => s + priceOf(byKey, k), 0);
    return roundMoney2(list * (1 - discountPercent / 100));
}
function quoteMonthly(catalog, raw) {
    const state = normalizeCalcState(raw);
    const byKey = new Map(catalog.modules.map((m) => [m.key, m]));
    const warnings = [];
    const lines = [];
    const selected = new Set(state.moduleKeys);
    for (const id of state.bundleIds) {
        const bundle = catalog.bundles.find((b) => b.marketingId === id);
        if (!bundle)
            continue;
        for (const k of bundle.moduleKeys)
            selected.add(k);
    }
    for (const key of [...selected]) {
        const gate = (0, pricing_catalog_canon_1.inferSatelliteKeyFromModuleKey)(key);
        if (gate && !selected.has(gate) && byKey.has(gate))
            selected.add(gate);
    }
    const activeKeys = (0, pricing_catalog_canon_1.applyCatalogMutex)([...selected]);
    let foundationAzn = 0;
    const nasForcesFoundation = activeKeys.includes("nas") || activeKeys.includes("industry_finance");
    if (state.foundation || nasForcesFoundation) {
        const waive = !nasForcesFoundation &&
            state.kafeWaiver &&
            (0, pricing_catalog_canon_1.shouldWaiveEraFoundation)({
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
    const claimed = new Set();
    for (const id of state.bundleIds) {
        const bundle = catalog.bundles.find((b) => b.marketingId === id);
        if (!bundle)
            continue;
        const billable = bundle.moduleKeys.filter((k) => !claimed.has(k) && !(0, pricing_catalog_canon_1.isOneShotCatalogKey)(k));
        if (billable.length === 0)
            continue;
        for (const k of billable)
            claimed.add(k);
        const listAzn = roundMoney2(billable.reduce((s, k) => s + priceOf(byKey, k), 0));
        const amountAzn = bundleAmount(billable, bundle.discountPercent, byKey);
        if (amountAzn <= 0 && listAzn <= 0)
            continue;
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
        if (claimed.has(key))
            continue;
        if ((0, pricing_catalog_canon_1.isOneShotCatalogKey)(key))
            continue;
        const mod = byKey.get(key);
        if (!mod)
            continue;
        const price = roundMoney2(mod.pricePerMonth);
        if (WORKFORCE_KEYS.has(key)) {
            if (price <= 0)
                continue;
        }
        if (price <= 0)
            continue;
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
        if (!(0, pricing_catalog_canon_1.isOneShotCatalogKey)(key))
            continue;
        const mod = byKey.get(key);
        if (!mod || mod.pricePerMonth <= 0)
            continue;
        lines.push({
            id: `once:${key}`,
            kind: "oneShot",
            group: "once",
            amountAzn: roundMoney2(mod.pricePerMonth),
            name: mod.name,
            key,
        });
    }
    const gateOn = (satelliteKey) => activeKeys.includes(satelliteKey);
    for (const driver of catalog.capacityDrivers) {
        if (!gateOn(driver.satelliteKey))
            continue;
        const count = clampInt(state.capacity[driver.satelliteKey] ?? driver.includedInGate);
        const extra = Math.max(0, count - driver.includedInGate);
        const amountAzn = roundMoney2(extra * driver.unitAzn);
        if (amountAzn <= 0)
            continue;
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
    const roomModule = (0, pricing_catalog_canon_1.clinicRoomBillableModule)(activeKeys);
    if (roomModule) {
        const def = pricing_catalog_canon_1.CLINIC_MODULE_CAPACITY.find((d) => d.moduleKey === roomModule);
        const included = def?.included ?? 5;
        const unitAzn = def?.unitAzn ?? 19;
        const extra = (0, pricing_catalog_canon_1.clinicCapacityOverage)(state.clinicRooms, included);
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
    }
    else if (state.clinicRooms > 5 && activeKeys.includes("industry_clinic")) {
        warnings.push("clinic_rooms_module");
    }
    if (activeKeys.includes("clinic_inpatient")) {
        const def = pricing_catalog_canon_1.CLINIC_MODULE_CAPACITY.find((d) => d.moduleKey === "clinic_inpatient");
        const included = def?.included ?? 5;
        const unitAzn = def?.unitAzn ?? 19;
        const extra = (0, pricing_catalog_canon_1.clinicCapacityOverage)(state.clinicBeds, included);
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
    }
    else if (state.clinicBeds > 5 && (activeKeys.includes("industry_clinic") || activeKeys.includes("clinic_inpatient"))) {
        warnings.push("clinic_beds_module");
    }
    const headcountRate = (0, pricing_catalog_canon_1.workforceHeadcountRateAzn)(activeKeys);
    if (headcountRate > 0 && state.workforceHeadcount > 0) {
        lines.push({
            id: "workforce",
            kind: "workforce",
            group: "people",
            amountAzn: roundMoney2(state.workforceHeadcount * headcountRate),
            headcount: state.workforceHeadcount,
            rate: headcountRate,
        });
    }
    else if (headcountRate > 0 && state.workforceHeadcount === 0) {
        warnings.push("workforce_headcount");
    }
    const erpIncluded = foundationAzn > 0 ? exports.ERP_LOGINS_INCLUDED : 0;
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
    const legalExtra = Math.max(0, state.legalEntities - exports.LEGAL_ENTITIES_INCLUDED);
    if (legalExtra > 0) {
        lines.push({
            id: "legal",
            kind: "legal",
            group: "people",
            amountAzn: roundMoney2(legalExtra * exports.LEGAL_ENTITY_MONTHLY_AZN),
            extra: legalExtra,
            unitAzn: exports.LEGAL_ENTITY_MONTHLY_AZN,
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
    const ocrIncluded = foundationAzn > 0 ? exports.OCR_INCLUDED_PAGES : 0;
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
        }
        else {
            const extraGb = Math.max(0, state.storageGb - exports.STORAGE_INCLUDED_GB);
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
        if (!activeKeys.includes("platform_notifications"))
            warnings.push("whatsapp_sku");
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
            amountAzn: roundMoney2(state.smsMessages * exports.SMS_PLATFORM_PER_MESSAGE_AZN),
            extra: state.smsMessages,
            unitAzn: exports.SMS_PLATFORM_PER_MESSAGE_AZN,
        });
    }
    if (state.acquiringTurnoverAzn > 0) {
        lines.push({
            id: "acquiring",
            kind: "acquiring",
            group: "usage",
            amountAzn: roundMoney2(state.acquiringTurnoverAzn * exports.ACQUIRING_RATE),
        });
    }
    if (state.tradeCreditBuyers > 0) {
        if (!activeKeys.includes("trade_credit_control"))
            warnings.push("trade_buyers_sku");
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
        if (!activeKeys.includes("trade_credit_factor_lead"))
            warnings.push("trade_enrich_sku");
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
    if (activeKeys.includes("industry_banking"))
        warnings.push("banking_sandbox");
    const sum = (group) => roundMoney2(lines.filter((l) => l.group === group).reduce((s, l) => s + l.amountAzn, 0));
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
//# sourceMappingURL=quote-calculator.js.map