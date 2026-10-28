/**
 * CP-ORG-PROFILE-01 Track A — which hotel letterhead fields are locked when
 * Sync has cached an org profile (SoR on orchestrator).
 */
export type CpLetterheadLocks = {
  active: boolean;
  address: boolean;
  phone: boolean;
  email: boolean;
  website: boolean;
  logo: boolean;
  /** Resolved values for read-only display when locked. */
  resolved: {
    address: string;
    phone: string;
    email: string;
    website: string;
    logoUrl: string;
  };
};

export function emptyCpLetterheadLocks(): CpLetterheadLocks {
  return {
    active: false,
    address: false,
    phone: false,
    email: false,
    website: false,
    logo: false,
    resolved: {
      address: "",
      phone: "",
      email: "",
      website: "",
      logoUrl: "",
    },
  };
}

export async function resolveCpLetterheadLocks(): Promise<CpLetterheadLocks> {
  const empty = emptyCpLetterheadLocks();
  try {
    const { getCachedOrgProfile, resolvePrintContacts } = await import(
      "@era/satellite-kit"
    );
    const { requestOrganizationId } = await import("@/lib/request-organization");
    const snap = getCachedOrgProfile(requestOrganizationId());
    if (!snap) return empty;
    const r = resolvePrintContacts({ org: snap });
    return {
      active: true,
      address: Boolean(r.address),
      phone: Boolean(r.phone),
      email: Boolean(r.email),
      website: Boolean(r.website),
      logo: Boolean(r.logoUrl),
      resolved: {
        address: r.address,
        phone: r.phone,
        email: r.email,
        website: r.website,
        logoUrl: r.logoUrl,
      },
    };
  } catch {
    return empty;
  }
}
