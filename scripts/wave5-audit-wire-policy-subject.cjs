const fs = require("fs");

const files = [
  "era-finance-core/apps/api/src/banking/banking.controller.ts",
  "era-finance-core/apps/api/src/inventory/inventory-reconciliation.controller.ts",
  "era-finance-core/apps/api/src/inventory/inventory-audit.controller.ts",
  "era-finance-core/apps/api/src/invoices/invoices.controller.ts",
  "era-finance-core/apps/api/src/accounting/manual-adjustment.controller.ts",
  "era-finance-core/apps/api/src/hr/payroll.controller.ts",
  "era-finance-core/apps/api/src/accounting/accounting.controller.ts",
];

for (const f of files) {
  let s = fs.readFileSync(f, "utf8");
  const before = s;

  if (!s.includes("requireOrgPolicySubject")) {
    if (s.includes('from "../auth/require-org-role"')) {
      s = s.replace(
        'import { requireOrgRole } from "../auth/require-org-role";',
        'import { requireOrgPolicySubject } from "../auth/policies/policy-subject";\nimport { requireOrgRole } from "../auth/require-org-role";',
      );
    } else if (s.includes('from "../../auth/require-org-role"')) {
      s = s.replace(
        'import { requireOrgRole } from "../../auth/require-org-role";',
        'import { requireOrgPolicySubject } from "../../auth/policies/policy-subject";\nimport { requireOrgRole } from "../../auth/require-org-role";',
      );
    }
  }

  // Replace authz argument usages; keep standalone `requireOrgRole(user);`
  s = s.replace(
    /,\s*requireOrgRole\(user\)\s*\)/g,
    ", requireOrgPolicySubject(user))",
  );
  s = s.replace(
    /\(organizationId, dto, requireOrgRole\(user\)\)/g,
    "(organizationId, dto, requireOrgPolicySubject(user))",
  );
  s = s.replace(
    /actingUserRole:\s*requireOrgRole\(user\)/g,
    "actingUser: requireOrgPolicySubject(user)",
  );
  s = s.replace(
    /actingUser:\s*toPolicySubject\(user\),\s*\n\s*actingUserRole:\s*requireOrgRole\(user\)/g,
    "actingUser: requireOrgPolicySubject(user)",
  );
  s = s.replace(
    /return this\.banking\.manualCashOut\(organizationId, dto, requireOrgRole\(user\)\);/g,
    "return this.banking.manualCashOut(organizationId, dto, requireOrgPolicySubject(user));",
  );
  s = s.replace(
    /requireOrgRole\(user\);\s*\n\s*return this\.banking\.manualBankEntry\(organizationId, dto\);/g,
    "return this.banking.manualBankEntry(organizationId, dto, requireOrgPolicySubject(user));",
  );

  if (s !== before) {
    fs.writeFileSync(f, s, "utf8");
    console.log("updated", f);
  } else {
    console.log("nochange", f);
  }
}
