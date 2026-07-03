/**
 * Merge VOEN-known donor datasets into azerbaijan-legal-entities.csv without
 * re-querying e-taxes when the VÖEN row already has tax_name populated.
 *
 * Sources:
 *   - data/government-procurement/azerbaijan-etender-suppliers.csv
 *   - data/financial-institutions/azerbaijan-insurers.csv
 *
 * New VÖENs without tax data get match_status=voen_known (name + VÖEN from source only).
 *
 * Usage:
 *   node tools/merge-voen-donors-into-legal-entities.mjs
 */

import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const DATA = path.join(ROOT, "data");
const OUT_CSV = path.join(DATA, "legal-entities", "azerbaijan-legal-entities.csv");

function parseCsv(text) {
  const rows = [];
  let i = 0;
  const len = text.length;
  const readField = () => {
    let field = "";
    if (text[i] === '"') {
      i++;
      while (i < len) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else field += text[i++];
      }
      if (text[i] === ",") i++;
      return field;
    }
    while (i < len && text[i] !== "," && text[i] !== "\n" && text[i] !== "\r") field += text[i++];
    if (text[i] === ",") i++;
    return field;
  };
  const headers = [];
  while (i < len && text[i] !== "\n" && text[i] !== "\r") headers.push(readField());
  while (text[i] === "\n" || text[i] === "\r") i++;
  while (i < len) {
    const row = {};
    for (const h of headers) row[h] = i < len ? readField() : "";
    rows.push(row);
    while (i < len && (text[i] === "\n" || text[i] === "\r")) i++;
  }
  return { headers, rows };
}

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function appendPipe(cur, val) {
  if (!val) return cur || "";
  if (!cur) return String(val);
  const parts = cur.split(" | ");
  return parts.includes(val) ? cur : `${cur} | ${val}`;
}

function loadCsv(rel) {
  const p = path.join(DATA, rel);
  if (!fs.existsSync(p)) return [];
  return parseCsv(fs.readFileSync(p, "utf8")).rows;
}

function donorFromEtender(row) {
  return {
    donor_id: row.id,
    donor_sector: "government-procurement",
    donor_search_name: row.supplier_name,
    donor_name: row.supplier_name,
    donor_voen: row.voen,
    donor_category: row.tender_types || "etender supplier",
    donor_extra: {
      contract_count: row.contract_count,
      total_amount_azn: row.total_amount_azn,
      last_contract_date: row.last_contract_date,
      buyer_examples: row.buyer_examples,
    },
  };
}

function donorFromInsurer(row) {
  return {
    donor_id: row.id,
    donor_sector: "financial-institutions",
    donor_search_name: row.name,
    donor_name: row.name,
    donor_legal_name: row.name,
    donor_address: row.address,
    donor_phone: row.phone,
    donor_email: row.email,
    donor_website: row.website,
    donor_voen: row.voen,
    donor_category: "insurer",
    donor_extra: {
      legal_form: row.legal_form,
      license_date: row.license_date,
      state_registered_at: row.state_registered_at,
    },
  };
}

function mergeDonorIntoRow(target, donor) {
  target.donor_sectors = appendPipe(target.donor_sectors, donor.donor_sector);
  target.donor_ids = appendPipe(target.donor_ids, donor.donor_id);
  target.donor_search_names = appendPipe(target.donor_search_names, donor.donor_search_name);
  target.donor_names = appendPipe(target.donor_names, donor.donor_name);
  target.donor_legal_names = appendPipe(target.donor_legal_names, donor.donor_legal_name || "");
  target.donor_addresses = appendPipe(target.donor_addresses, donor.donor_address || "");
  target.donor_phones = appendPipe(target.donor_phones, donor.donor_phone || "");
  target.donor_emails = appendPipe(target.donor_emails, donor.donor_email || "");
  target.donor_websites = appendPipe(target.donor_websites, donor.donor_website || "");
  target.donor_voens = appendPipe(target.donor_voens, donor.donor_voen || "");
  target.donor_categories = appendPipe(target.donor_categories, donor.donor_category || "");
  const extra = JSON.stringify(donor.donor_extra ?? {});
  target.donor_extra_json = appendPipe(target.donor_extra_json, extra);
  if (!target.voen && donor.donor_voen) target.voen = donor.donor_voen;
  if (!target.tax_name && donor.donor_name) target.tax_name = donor.donor_name;
}

function emptyRow() {
  return {
    match_status: "voen_known",
    search_query: "",
    voen: "",
    tax_name: "",
    tax_legal_address: "",
    tax_legitimate: "",
    tax_legal_form: "",
    tax_charter_capital: "",
    tax_voen_registered_at: "",
    tax_state_registered_at: "",
    tax_status: "",
    tax_active: "",
    tax_vat_payer: "",
    tax_risky_payer: "",
    tax_debt: "",
    tax_authority: "",
    tax_organization_type: "",
    donor_sectors: "",
    donor_ids: "",
    donor_search_names: "",
    donor_names: "",
    donor_cities: "",
    donor_addresses: "",
    donor_phones: "",
    donor_emails: "",
    donor_websites: "",
    donor_voens: "",
    donor_categories: "",
    donor_extra_json: "",
    tax_extract_date: "",
    tax_financial_year_start: "",
    tax_financial_year_end: "",
    tax_sanctions: "",
    tax_raw_json: "",
  };
}

function main() {
  if (!fs.existsSync(OUT_CSV)) {
    console.error(`Missing ${OUT_CSV}`);
    process.exit(1);
  }

  const { headers, rows } = parseCsv(fs.readFileSync(OUT_CSV, "utf8"));
  const byVoen = new Map();
  for (const row of rows) {
    const voen = String(row.voen || "").replace(/\D/g, "");
    if (voen.length === 10) byVoen.set(voen, row);
  }

  const donors = [
    ...loadCsv("government-procurement/azerbaijan-etender-suppliers.csv").map(donorFromEtender),
    ...loadCsv("financial-institutions/azerbaijan-insurers.csv").map(donorFromInsurer),
  ];

  let merged = 0;
  let added = 0;
  let skippedHasTax = 0;

  for (const donor of donors) {
    const voen = String(donor.donor_voen || "").replace(/\D/g, "");
    if (voen.length !== 10) continue;

    const existing = byVoen.get(voen);
    if (existing) {
      const hadTax = Boolean(existing.tax_name && existing.match_status === "tax_matched");
      mergeDonorIntoRow(existing, donor);
      if (hadTax) {
        skippedHasTax++;
      } else if (!existing.match_status || existing.match_status === "no_tax_match") {
        existing.match_status = existing.tax_name ? "tax_matched" : "voen_known";
      }
      merged++;
      continue;
    }

    const row = emptyRow();
    row.voen = voen;
    row.tax_name = donor.donor_name || donor.donor_search_name || "";
    row.search_query = `voen:${voen}`;
    mergeDonorIntoRow(row, donor);
    rows.push(row);
    byVoen.set(voen, row);
    added++;
  }

  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => csvEscape(r[h])).join(","))].join(
    "\n",
  );
  fs.writeFileSync(OUT_CSV, csv, "utf8");

  const stats = {
    donors_processed: donors.length,
    merged_into_existing: merged,
    new_rows_added: added,
    skipped_etaxes_requery: skippedHasTax,
    total_rows: rows.length,
  };
  console.log(stats);
}

main();
