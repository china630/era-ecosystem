/**
 * CP-ORG-PROFILE-01 Track A — clinic print header fields locked when orch
 * snapshot is cached via Sync.
 */
export type CpPrintLocks = {
  active: boolean;
  logo: boolean;
  address: boolean;
  phone: boolean;
  email: boolean;
  website: boolean;
  resolved: {
    name: string;
    address: string;
    phone: string;
    email: string;
    website: string;
    logoUrl: string;
  };
};

export function emptyCpPrintLocks(): CpPrintLocks {
  return {
    active: false,
    logo: false,
    address: false,
    phone: false,
    email: false,
    website: false,
    resolved: {
      name: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      logoUrl: "",
    },
  };
}

export async function resolveCpPrintLocks(): Promise<CpPrintLocks> {
  const empty = emptyCpPrintLocks();
  try {
    const kit = await import("@era/satellite-kit");
    let orgId: string | null = null;
    try {
      orgId = kit.satelliteOrganizationId();
    } catch {
      orgId = null;
    }
    const snap = kit.getCachedOrgProfile(orgId);
    if (!snap) return empty;
    const r = kit.resolvePrintContacts({ org: snap });
    return {
      active: true,
      logo: Boolean(r.logoUrl),
      address: Boolean(r.address),
      phone: Boolean(r.phone),
      email: Boolean(r.email),
      website: Boolean(r.website),
      resolved: {
        name: r.name,
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
