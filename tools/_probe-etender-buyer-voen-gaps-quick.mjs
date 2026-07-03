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

async function fetchJson(url, tries = 6) {
  for (let i = 1; i <= tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "ERA-probe/1.0" },
        signal: AbortSignal.timeout(90_000),
      });
      if (r.status === 429) {
        await sleep(3000 * i);
        continue;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    } catch (e) {
      if (i === tries) throw e;
      await sleep(1000 * i);
    }
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const failures = [];
const seen = new Set();

for (const es of [1, 2, 3, 4]) {
  for (let page = 1; page <= (es === 2 ? 25 : 10); page++) {
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

      await sleep(80);
      try {
        const detail = await fetchJson(`${LIST}/${it.eventId}`);
        const voen = String(detail.organizationVoen ?? "").trim();
        if (!isAzVoen(voen)) {
          failures.push({
            reason: voen ? "invalid_voen_format" : "missing_voen_in_api",
            list_name: name,
            event_id: it.eventId,
            event_status: es,
            organizationVoen: voen,
            detail_name: detail.organizationName ?? "",
            etender_url: `https://etender.gov.az/main/competition/detail/${it.eventId}`,
          });
        }
      } catch (e) {
        failures.push({
          reason: "detail_fetch_failed",
          list_name: name,
          event_id: it.eventId,
          event_status: es,
          organizationVoen: "",
          error: e.message,
          etender_url: `https://etender.gov.az/main/competition/detail/${it.eventId}`,
        });
      }
      if (failures.length >= 20) break;
    }
    if (failures.length >= 20) break;
    await sleep(150);
  }
  if (failures.length >= 20) break;
}

const out = path.join(import.meta.dirname, "../data/government-procurement/etender-buyer-voen-gaps-sample.json");
fs.writeFileSync(out, JSON.stringify({ sampled_names: seen.size, failures }, null, 2), "utf8");
console.log(`Sampled ${seen.size} unique names, found ${failures.length} gaps\n`);
for (const f of failures) {
  console.log(`[${f.reason}] #${f.event_id} (status ${f.event_status})`);
  console.log(`  name: ${f.list_name}`);
  console.log(`  API organizationVoen: ${JSON.stringify(f.organizationVoen)}`);
  if (f.detail_name) console.log(`  detail name: ${f.detail_name}`);
  if (f.etender_url) console.log(`  ${f.etender_url}`);
  console.log("");
}
