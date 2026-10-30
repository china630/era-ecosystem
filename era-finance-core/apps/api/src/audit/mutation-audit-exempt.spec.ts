import {
  FINANCE_MUTATION_AUDIT_EXEMPT_EXTRA,
  financeAuditPathname,
  isFinanceMutationAuditExempt,
} from "./mutation-audit-exempt";
import {
  DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES,
  isMutationAuditExemptPath,
} from "@era/satellite-kit";

describe("Finance mutation audit exempt (AC-FIN-AUD kit align)", () => {
  it("normalizes Nest paths to /api/…", () => {
    expect(financeAuditPathname("/auth/login")).toBe("/api/auth/login");
    expect(financeAuditPathname("/api/auth/login")).toBe("/api/auth/login");
    expect(financeAuditPathname("/api/auth/login?x=1")).toBe("/api/auth/login");
  });

  it("exempts kit baseline auth / health / locale / early-access", () => {
    expect(isFinanceMutationAuditExempt("/api/auth/login")).toBe(true);
    expect(isFinanceMutationAuditExempt("/auth/refresh")).toBe(true);
    expect(isFinanceMutationAuditExempt("/api/auth/logout")).toBe(true);
    expect(isFinanceMutationAuditExempt("/api/health")).toBe(true);
    expect(isFinanceMutationAuditExempt("/api/locale")).toBe(true);
    expect(isFinanceMutationAuditExempt("/api/early-access/events")).toBe(true);
  });

  it("exempts Finance extras (register-user, billing webhooks, drakaris, admin audit)", () => {
    expect(isFinanceMutationAuditExempt("/api/auth/register-user")).toBe(true);
    expect(isFinanceMutationAuditExempt("/billing/webhooks/x")).toBe(true);
    expect(isFinanceMutationAuditExempt("/api/integrations/drakaris/hook")).toBe(
      true,
    );
    expect(isFinanceMutationAuditExempt("/admin/audit/integrity-check")).toBe(
      true,
    );
    expect(isFinanceMutationAuditExempt("/api/admin/audit/verify-chain")).toBe(
      true,
    );
  });

  it("does not exempt ordinary money mutations or security-audit reads", () => {
    expect(isFinanceMutationAuditExempt("/api/invoices")).toBe(false);
    expect(isFinanceMutationAuditExempt("/api/admin/security-audit")).toBe(
      false,
    );
    expect(isFinanceMutationAuditExempt("/api/healthcare")).toBe(false);
  });

  it("keeps Finance extras as a documented overlay on kit defaults", () => {
    expect(DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES.length).toBeGreaterThan(0);
    expect(FINANCE_MUTATION_AUDIT_EXEMPT_EXTRA).toContain(
      "/api/auth/register-user",
    );
    expect(
      isMutationAuditExemptPath(
        "/api/auth/login",
        FINANCE_MUTATION_AUDIT_EXEMPT_EXTRA,
      ),
    ).toBe(true);
  });
});
