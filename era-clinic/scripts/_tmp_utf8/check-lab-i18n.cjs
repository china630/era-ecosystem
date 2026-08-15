const fs = require("fs");
const path = require("path");

// Run inside container or locally against messages
const base = fs.existsSync("/app/messages") ? "/app/messages" : "era-clinic/messages";
for (const loc of ["en", "az", "ru"]) {
  const p = path.join(base, `${loc}.json`);
  try {
    const m = JSON.parse(fs.readFileSync(p, "utf8"));
    const need = [
      "labOrders.title",
      "labOrders.createTitle",
      "labOrders.searchCatalog",
      "labOrders.selectedCount",
      "common.all",
      "common.loading",
      "common.complete",
      "common.save",
      "nav.home",
      "nav.labOrders",
    ];
    const missing = [];
    for (const k of need) {
      const parts = k.split(".");
      let cur = m;
      for (const part of parts) cur = cur?.[part];
      if (cur == null) missing.push(k);
    }
    console.log(loc, missing.length ? `MISSING ${missing.join(",")}` : "ok");
  } catch (e) {
    console.log(loc, "PARSE_ERROR", e.message);
  }
}
