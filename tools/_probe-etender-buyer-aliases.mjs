/** Find list-name aliases that share the same VOEN (explains seen_names > unique_voen). */
import fs from "node:fs";
import path from "node:path";

const LIST = "https://etender.gov.az/api/events";
const isAzVoen = (v) => /^\d{10}$/.test(String(v ?? "").trim());
const norm = (n) =>
  String(n ?? "")
    .trim()
    .toUpperCase()
    .replace(/[""„«»]/g, '"')
    .replace(/\s+/g, " ");

async function fetchJson(url, tries = 5) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(90_000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    } catch (e) {
      if (i === tries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * i));
    }
  }
}

const nameToVoen = new Map();
const voenToNames = new Map();
const missing = [];
const seen = new Set();

for (const es of [1, 2, 3, 4]) {
  for (let page = 1; page <= (es === 2 ? 15 : 5); page++) {
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
      j = await fetchJson(`${LIST}?${params}`);
    } catch {
      continue;
    }
    for (const it of j.items ?? []) {
      const name = it.buyerOrganizationName ?? "";
      const key = norm(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      try {
        const detail = await fetchJson(`${LIST}/${it.eventId}`);
        const voen = String(detail.organizationVoen ?? "").trim();
        if (!isAzVoen(voen)) {
          missing.push({ reason: voen ? "invalid_format" : "missing", name, event_id: it.eventId, voen });
          continue;
        }
        nameToVoen.set(key, voen);
        const arr = voenToNames.get(voen) ?? [];
        arr.push(name);
        voenToNames.set(voen, arr);
      } catch (e) {
        missing.push({ reason: "fetch_failed", name, event_id: it.eventId, error: e.message });
      }
    }
  }
}

const aliases = [...voenToNames.entries()]
  .filter(([, names]) => names.length > 1)
  .map(([voen, names]) => ({ voen, names }))
  .slice(0, 10);

const out = {
  sampled_unique_names: seen.size,
  unique_voen: voenToNames.size,
  missing_count: missing.length,
  alias_groups: aliases,
  missing_examples: missing.slice(0, 20),
};
fs.writeFileSync(
  path.join(import.meta.dirname, "../data/government-procurement/etender-buyer-name-voen-analysis.json"),
  JSON.stringify(out, null, 2),
);
console.log(JSON.stringify(out, null, 2));
