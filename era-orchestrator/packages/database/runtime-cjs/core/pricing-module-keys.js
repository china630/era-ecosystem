"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_CASH_BANK_MODULE_KEYS = exports.PRICING_MODULE_CASH_BANK_PRO = void 0;
exports.isLegacyCashBankModuleKey = isLegacyCashBankModuleKey;
exports.hasCashBankModuleInList = hasCashBankModuleInList;
exports.normalizeCashBankActiveModules = normalizeCashBankActiveModules;
/** Canonical billing key: kassa + banking (single commercial module). */
exports.PRICING_MODULE_CASH_BANK_PRO = "cash_bank_pro";
exports.LEGACY_CASH_BANK_MODULE_KEYS = [
    "kassa_pro",
    "banking_pro",
    "kassa",
];
function isLegacyCashBankModuleKey(key) {
    return exports.LEGACY_CASH_BANK_MODULE_KEYS.includes(key);
}
function hasCashBankModuleInList(modules) {
    const set = new Set(modules);
    if (set.has(exports.PRICING_MODULE_CASH_BANK_PRO))
        return true;
    return exports.LEGACY_CASH_BANK_MODULE_KEYS.some((k) => set.has(k));
}
/** Collapse legacy slugs to `cash_bank_pro` for persistence. */
function normalizeCashBankActiveModules(modules) {
    const set = new Set(modules);
    const hadCashBank = hasCashBankModuleInList(modules);
    for (const legacy of exports.LEGACY_CASH_BANK_MODULE_KEYS) {
        set.delete(legacy);
    }
    set.delete(exports.PRICING_MODULE_CASH_BANK_PRO);
    if (hadCashBank) {
        set.add(exports.PRICING_MODULE_CASH_BANK_PRO);
    }
    return [...set];
}
