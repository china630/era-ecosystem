const fs = require("fs");
const f = "era-finance-core/apps/api/src/inventory/inventory.service.ts";
let s = fs.readFileSync(f, "utf8");
const needle = "await this.accounting.postJournalInTransaction(tx, {";
let count = 0;
let out = "";
let i = 0;
while (i < s.length) {
  const idx = s.indexOf(needle, i);
  if (idx < 0) {
    out += s.slice(i);
    break;
  }
  out += s.slice(i, idx);
  const window = s.slice(idx, idx + 400);
  if (window.includes("accountingBookId")) {
    out += needle;
    i = idx + needle.length;
    continue;
  }
  count += 1;
  out +=
    "const stockOpsBookId = await this.resolveStockOpsBookId(organizationId, tx);\n" +
    "      await this.accounting.postJournalInTransaction(tx, {\n" +
    "        accountingBookId: stockOpsBookId,";
  i = idx + needle.length;
}
fs.writeFileSync(f, out, "utf8");
console.log("patched", count);
