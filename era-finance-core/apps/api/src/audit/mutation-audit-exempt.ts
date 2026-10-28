/**
 * Finance Layer A deny-list — aligned to kit DEFAULT_MUTATION_AUDIT_EXEMPT_PREFIXES (AC-FIN-AUD).
 * Extra prefixes are Finance-only (Nest register-user, billing webhooks, Drakaris,
 * admin audit integrity/verify — avoid self-audit / hash-chain noise).
 */
import { isMutationAuditExemptPath } from "@era/satellite-kit";

/** Paths in addition to kit defaults (exact or child via kit helper). */
export const FINANCE_MUTATION_AUDIT_EXEMPT_EXTRA = [
  "/api/auth/register-user",
  "/api/billing/webhooks",
  "/api/integrations/drakaris",
  // audit-exempt: integrity-check / verify-chain must not write AuditLog rows
  "/api/admin/audit",
] as const;

/** Normalize Nest `req.path` / `req.url` to `/api/...` for kit matching. */
export function financeAuditPathname(pathRaw: string): string {
  const q = (pathRaw.split("?")[0] ?? "").trim() || "/";
  if (q.startsWith("/api/") || q === "/api") return q;
  return q.startsWith("/") ? `/api${q}` : `/api/${q}`;
}

export function isFinanceMutationAuditExempt(pathRaw: string): boolean {
  return isMutationAuditExemptPath(
    financeAuditPathname(pathRaw),
    FINANCE_MUTATION_AUDIT_EXEMPT_EXTRA,
  );
}
