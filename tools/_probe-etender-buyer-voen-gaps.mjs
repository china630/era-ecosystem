/**
 * Find buyer names where detail API has no valid 10-digit AZ VOEN.
 * One-off probe — not part of npm scripts.
 */
import fs from "node:fs";
import path from "node:path";

const LIST = "https://etender.gov.az/api/events";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isAzVoen(v) {
  return /^\d{10}$/.test(String(v ?? "").trim());
}

function norm(n) {
  return String(n ?? "")
    .trim()
    .toUpperCase()
    .replace(/[""„«»]/g, '"')
    .replace(/\s+/g, " ");
}

const failures = [];
const seen = new Set();

for (const es of [1, 2, 3, 4]) {
  const maxPage = es === 2 ? 40 : 15;
  for (let page = 1; page <= maxPage; page++) {
    const params = new URLSearchParams({
      EventType: "2",
      EventStatus: String(es),
      PageSize: "50",
      PageNumber: String(page),
      Keyword: "",
      buyerOrganizationName: "",
      documentNumber: "",
      publishDateFrom: "",
      publishDateTo: "",
    });
    let j;
    try {
      const r = await fetch(`${LIST}?${params}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(60_000),
      });
      j = await r.json();
    } catch {
      continue;
    }

    for (const it of j.items ?? []) {
      const name = it.buyerOrganizationName ?? "";
      const key = norm(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);

      await sleep(150);
      let detail;
      try {
        const r = await fetch(`${LIST}/${it.eventId}`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(60_000),
        });
        detail = await r.json();
      } catch (e) {
        failures.push({
          reason: "detail_fetch_failed",
          list_name: name,
          event_id: it.eventId,
          event_status: es,
          organizationVoen: "",
          detail_name: "",
          error: e.message,
        });
        if (failures.length >= 30) break;
        continue;
      }

      const voen = String(detail.organizationVoen ?? "").trim();
      if (!isAzVoen(voen)) {
        failures.push({
          reason: voen ? "invalid_voen_format" : "missing_voen",
          list_name: name,
          event_id: it.eventId,
          event_status: es,
          organizationVoen: voen,
          detail_name: detail.organizationName ?? "",
        });
      }
      if (failures.length >= 30) break;
    }
    if (failures.length >= 30) break;
    await sleep(200);
  }
  if (failures.length >= 30) break;
}

const out = path.join(import.meta.dirname, "../data/government-procurement/etender-buyer-voen-gaps-sample.json");
fs.writeFileSync(out, JSON.stringify({ sampled_unique_names: seen.size, failures: failures.slice(0, 20) }, null, 2));
console.log(`sampled ${seen.size} unique names, ${failures.length} without valid VOEN`);
for (const f of failures.slice(0, 20)) {
  console.log(`---\n[${f.reason}] event ${f.event_id} status ${f.event_status}`);
  console.log(`list: ${f.list_name}`);
  console.log(`detail voen: ${JSON.stringify(f.organizationVoen)}`);
  if (f.detail_name) console.log(`detail name: ${f.detail_name}`);
}
