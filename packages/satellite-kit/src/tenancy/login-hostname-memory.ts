export type LoginHostnameKind = "portal" | "satellite_login";

export type LoginHostnameEntry = {
  organizationId: string;
  satelliteKey: string | null;
  kind: LoginHostnameKind;
  status: "ACTIVE" | "PENDING_DNS" | "DISABLED";
};

const memory = new Map<string, LoginHostnameEntry>();

export function normalizeLoginHostname(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, "");
}

export function clearLoginHostnameCacheForTests(): void {
  memory.clear();
}

export function upsertLoginHostname(hostname: string, entry: LoginHostnameEntry): void {
  memory.set(normalizeLoginHostname(hostname), {
    organizationId: entry.organizationId.trim(),
    satelliteKey: entry.satelliteKey?.trim() || null,
    kind: entry.kind,
    status: entry.status,
  });
}

export function lookupLoginHostname(hostname: string): LoginHostnameEntry | null {
  return memory.get(normalizeLoginHostname(hostname)) ?? null;
}

export function removeLoginHostnamesForOrg(organizationId: string): void {
  const orgId = organizationId.trim();
  for (const [host, entry] of [...memory.entries()]) {
    if (entry.organizationId === orgId) {
      memory.delete(host);
    }
  }
}

export function resolveLoginHost(
  hostname: string,
  satelliteKey?: string | null,
): { organizationId: string } | null {
  const entry = lookupLoginHostname(hostname);
  if (!entry || entry.status !== "ACTIVE") return null;
  if (entry.kind !== "satellite_login") return null;
  const wantKey = satelliteKey?.trim();
  if (wantKey && entry.satelliteKey && entry.satelliteKey !== wantKey) {
    return null;
  }
  return { organizationId: entry.organizationId };
}

export function satelliteKeyFromEnv(): string | undefined {
  const raw = process.env.ERA_SATELLITE_KEY?.trim();
  return raw || undefined;
}

export function resolveHostBoundLoginOrganizationId(
  hostHeader: string | null | undefined,
  satelliteKey?: string | null,
): string | null {
  if (!hostHeader?.trim()) return null;
  const host = hostHeader.split(",")[0]?.trim();
  if (!host) return null;
  const hit = resolveLoginHost(host, satelliteKey ?? satelliteKeyFromEnv());
  return hit?.organizationId ?? null;
}
