const byOrg = new Map<string, readonly string[]>();

/**
 * Per-org audit exempt prefixes from Organization.settings,
 * pushed on runtime-config sync. Empty or missing means the kit default list.
 */
export function setOrgAuditExemptPrefixes(
  organizationId: string,
  prefixes: readonly string[] | null | undefined,
): void {
  const orgId = organizationId.trim();
  if (!orgId) return;
  const list = (prefixes ?? [])
    .map((item) => item.trim())
    .filter((item) => item.startsWith("/api/"));
  if (list.length === 0) {
    byOrg.delete(orgId);
    return;
  }
  byOrg.set(orgId, list);
}

export function orgAuditExemptPrefixes(organizationId: string | null | undefined): readonly string[] | null {
  if (!organizationId) return null;
  return byOrg.get(organizationId) ?? null;
}
