const fs = require("fs");
const f = "era-finance-core/apps/api/src/banking/banking.service.ts";
let s = fs.readFileSync(f, "utf8");

// Simpler: for each postJournal without accountingBookId, insert ops resolve before the statement.
const re =
  /(\n\s*)((?:const \{ transactionId \} = )?await this\.accounting\.postJournalInTransaction\(tx, \{)\n(\s*)organizationId,/g;

let count = 0;
s = s.replace(re, (match, indent, call, innerIndent) => {
  if (match.includes("accountingBookId")) return match;
  // look back for recent opsBook in same block — skip if already present nearby
  count += 1;
  if (call.startsWith("const { transactionId }")) {
    return `${indent}const opsBook = await this.accountingBooks.resolveOpsBookForMoneyPath(organizationId, undefined, tx);${indent}const { transactionId } = await this.accounting.postJournalInTransaction(tx, {${indent}${innerIndent}accountingBookId: opsBook.id,${indent}${innerIndent}organizationId,`;
  }
  return `${indent}const opsBook = await this.accountingBooks.resolveOpsBookForMoneyPath(organizationId, undefined, tx);${indent}await this.accounting.postJournalInTransaction(tx, {${indent}${innerIndent}accountingBookId: opsBook.id,${indent}${innerIndent}organizationId,`;
});

fs.writeFileSync(f, s, "utf8");
console.log("patched", count);
console.log("with accountingBookId", (s.match(/accountingBookId: opsBook\.id/g) || []).length);
console.log("bad", (s.match(/= const opsBook/g) || []).length);
