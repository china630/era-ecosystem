/** Pure lead assign gates (AC-CRM-PIPE negative paths). */

const ASSIGN_ROLES = new Set(["SALES_LEAD", "BUSINESS_OWNER"]);

export function assignLeadDenied(role: string | null | undefined): string | null {
  if (!role || !ASSIGN_ROLES.has(role)) {
    return "Forbidden — SALES_LEAD or BUSINESS_OWNER required";
  }
  return null;
}
