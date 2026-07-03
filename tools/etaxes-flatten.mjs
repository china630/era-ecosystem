/** Shared e-taxes API entity → flat row. */

export function pickLocale(obj, key = "az") {
  if (!obj || typeof obj !== "object") return "";
  const v = obj[key] ?? obj.az ?? obj.ru ?? obj.en;
  return typeof v === "string" ? v : "";
}

export function flattenTaxpayer(tp, searchQuery) {
  const lts = tp.legalTaxpayerStatus ?? {};
  const lf = lts.legalForm?.name ?? {};
  const ts = lts.taxpayerStatus?.name ?? {};
  const ta = tp.taxAuthority?.name ?? lts.taxAuthority?.name ?? {};
  return {
    search_query: searchQuery,
    tax_name: tp.name ?? "",
    voen: tp.tin ?? "",
    tax_type: tp.type ?? "",
    tax_debt: tp.debt ?? "",
    tax_active: tp.active ?? "",
    tax_vat_payer: tp.vatPayer ?? "",
    tax_risky_payer: tp.riskyPayer ?? "",
    tax_sanctions: Array.isArray(tp.sanctions) ? tp.sanctions.join(" | ") : "",
    tax_organization_name: tp.taxOrganizationName ?? "",
    tax_organization_type: tp.organizationType ?? "",
    tax_amount_azn: tp.amountAzn ?? "",
    tax_foreign_amount: tp.foreignAmount ?? "",
    tax_foreign_currency: tp.foreignCurrency ?? "",
    tax_legal_address: lts.legalAddress ?? "",
    tax_legitimate: lts.legitimate ?? "",
    tax_legal_form_code: lts.legalForm?.code ?? "",
    tax_legal_form: pickLocale(lf),
    tax_charter_capital: lts.charterCapital ?? "",
    tax_financial_year_start: lts.financialYearStart ?? "",
    tax_financial_year_end: lts.financialYearEnd ?? "",
    tax_voen_registered_at: lts.voenRegisteredAt ?? "",
    tax_state_registered_at: lts.stateRegisteredAt ?? "",
    tax_extract_date: lts.extractDate ?? "",
    tax_status_code: lts.taxpayerStatus?.code ?? "",
    tax_status: pickLocale(ts),
    tax_authority_code: tp.taxAuthority?.code ?? lts.taxAuthority?.code ?? "",
    tax_authority: pickLocale(ta),
    tax_legal_debt: lts.debt ?? "",
    tax_tasks_obligations: lts.tasksAndObligations ?? "",
    tax_raw_json: JSON.stringify(tp),
  };
}

export function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
