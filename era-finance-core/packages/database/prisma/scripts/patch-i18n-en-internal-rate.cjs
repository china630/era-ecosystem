const fs = require("fs");
const f = "era-finance-core/packages/i18n/src/resources.ts";
let s = fs.readFileSync(f, "utf8");

// EN employees block — add internalRate after bulkSalaryDone if missing
if (!s.includes('internalRate: "Internal rate (AZN)"')) {
  const enNeedle =
    '        bulkSalaryDone: "Updated {{updated}} salaries (missing {{missing}})",\n        emas: {';
  const enRepl =
    '        bulkSalaryDone: "Updated {{updated}} salaries (missing {{missing}})",\n' +
    '        salaryGross: "Contract salary gross (AZN)",\n' +
    '        internalRate: "Internal rate (AZN)",\n' +
    '        internalRateHint: "Management book only (MGMT); statutory payroll uses contract salary.",\n' +
    "        emas: {";
  if (!s.includes(enNeedle)) {
    console.error("EN needle missing");
  } else {
    s = s.replace(enNeedle, enRepl);
  }
}

s = s.replace(
  'bulkSalaryHint: "CSV columns: employeeId,salary (UUID + contract gross AZN)"',
  'bulkSalaryHint: "CSV columns: employeeId,salary[,internalRate] (UUID + contract gross AZN; rate = OWNER/ADMIN)"',
);
s = s.replace(
  /bulkSalaryHint: "CSV columns: employeeId,salary \(UUID \+ contract gross AZN\)"/g,
  'bulkSalaryHint: "CSV columns: employeeId,salary[,internalRate] (UUID + contract gross AZN; rate = OWNER/ADMIN)"',
);

fs.writeFileSync(f, s, "utf8");
console.log("i18n en/hints patched", s.includes('internalRate: "Internal rate (AZN)"'));
