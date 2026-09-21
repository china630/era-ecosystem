const fs = require("fs");

function patchInvoices() {
  const f = "era-finance-core/apps/api/src/invoices/invoices.service.ts";
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("PolicySubject")) {
    s = s.replace(
      'from "../auth/policies/invoice-finance.policy";',
      'from "../auth/policies/invoice-finance.policy";\nimport type { PolicySubject } from "../auth/policies/invoice-finance.policy";',
    );
  }
  s = s.replace(/role: UserRole,/g, "role: UserRole | PolicySubject,");
  fs.writeFileSync(f, s);
  console.log("invoices.service");
}

function patchPayroll() {
  const f = "era-finance-core/apps/api/src/hr/payroll.service.ts";
  let s = fs.readFileSync(f, "utf8");
  if (!s.includes("PolicySubject")) {
    s = s.replace(
      'from "../auth/policies/hr-payroll.policy";',
      'from "../auth/policies/hr-payroll.policy";\nimport type { PolicySubject } from "../auth/policies/invoice-finance.policy";',
    );
  }
  s = s.replace(
    "actingUserRole: UserRole,",
    "actingUserRole: UserRole | PolicySubject,",
  );
  fs.writeFileSync(f, s);
  console.log("payroll.service");
}

patchInvoices();
patchPayroll();
