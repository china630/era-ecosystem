/**
 * Finance DB Permission catalog — canonical CP keys (Wave 5).
 * Runtime AuthZ does NOT read these rows; JWT `permissions[]` from Orchestrator
 * (`@era/contracts` CP_PERMISSION) is the door. Seed keeps codes aligned so
 * leftover RolePermission joins do not reintroduce Wave E-C bare codes.
 */
export const PERMISSIONS = [
  { code: "api:billing.read", category: "BILLING", description: "Read SaaS billing" },
  { code: "api:billing.manage", category: "BILLING", description: "Manage subscription (owner bypass)" },
  { code: "api:ledger.post", category: "ACCOUNTING", description: "Post GL / cash / bank" },
  { code: "api:ledger.read", category: "ACCOUNTING", description: "Read ledger" },
  { code: "api:ledger.period_close", category: "ACCOUNTING", description: "Close/reopen accounting period" },
  { code: "api:invoices.create", category: "SALES", description: "Create sales invoices" },
  { code: "api:invoices.update", category: "SALES", description: "Update sales invoices / payments" },
  { code: "api:purchases.manage", category: "PURCHASES", description: "Procurement workflow" },
  { code: "api:payroll.hr_card", category: "HR", description: "HR card / timesheet (no payroll money)" },
  { code: "api:payroll.money", category: "HR", description: "Payroll run / payout" },
  { code: "api:inventory.approve", category: "INVENTORY", description: "Inventory approve / complete + stock GL" },
  { code: "api:psa.manage", category: "PSA", description: "Projects and time entries" },
  { code: "api:reports.nas", category: "REPORTING", description: "NAS reports" },
  { code: "api:book.mgmt", category: "ACCOUNTING", description: "MANAGEMENT book / compare" },
  { code: "admin:org.settings", category: "ADMIN", description: "Org settings / extra-fields" },
  { code: "admin:platform", category: "ADMIN", description: "Platform super-admin (locked)" },
] as const;

/** Wave E-C bare codes — deleted on seed so they cannot be a second SoT. */
export const LEGACY_BARE_PERMISSION_CODES = [
  "billing.manage",
  "accounting.post",
  "invoices.create",
  "invoices.update",
  "purchases.manage",
  "hr.manage",
  "inventory.manage",
  "psa.manage",
  "reporting.view",
  "admin.system",
] as const;
