const fs = require("fs");
const f = "era-finance-core/apps/api/src/inventory/inventory.service.ts";
let s = fs.readFileSync(f, "utf8");
s = s.replace(
  /const \{ transactionId \} = const stockOpsBookId = await this\.resolveStockOpsBookId\(organizationId, tx\);\n\s*await this\.accounting\.postJournalInTransaction\(tx, \{\n\s*accountingBookId: stockOpsBookId,/g,
  `const stockOpsBookId = await this.resolveStockOpsBookId(organizationId, tx);
      const { transactionId } = await this.accounting.postJournalInTransaction(tx, {
        accountingBookId: stockOpsBookId,`,
);
fs.writeFileSync(f, s, "utf8");
const bad = (s.match(/= const stockOpsBookId/g) || []).length;
console.log("remaining bad", bad);
