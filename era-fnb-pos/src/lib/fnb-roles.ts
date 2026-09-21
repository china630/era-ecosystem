/** @deprecated Role-name packages — use Variant A grants (`PERMISSIONS` / `denyUnlessPermission`). */
export const FB_TILL_ROLES = ["FB_WAITER", "FB_MANAGER", "FB_CASHIER"] as const;

/** @deprecated Prefer `PERMISSIONS.KDS_BUMP` grants. */
export const FB_KDS_ROLES = ["FB_KITCHEN", "FB_WAITER", "FB_MANAGER"] as const;

/**
 * @deprecated Prefer edition templates: kafe waiter omits `api:tickets.pay`.
 * Kept for error message code compatibility only.
 */
export function payRolesForKafe(kafe: boolean): string[] {
  if (kafe) return ["FB_CASHIER", "FB_MANAGER"];
  return ["FB_WAITER", "FB_MANAGER", "FB_CASHIER"];
}

export class FnbWaiterNoPayError extends Error {
  readonly status = 403;
  readonly code = "FNB_WAITER_NO_PAY";
  constructor() {
    super("Waiter PIN cannot settle the ticket — cashier or owner pays");
    this.name = "FnbWaiterNoPayError";
  }
}
