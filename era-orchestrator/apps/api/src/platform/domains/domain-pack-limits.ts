import { BadRequestException, ConflictException } from "@nestjs/common";
import {
  PlatformCustomDomainKind,
  PlatformCustomDomainStatus,
  type Prisma,
} from "@era365/database";

const DOMAIN_BASIC = "platform_domain";
const DOMAIN_ORG_PACK = "platform_domain_org";

const ACTIVE_OR_PENDING: PlatformCustomDomainStatus[] = [
  PlatformCustomDomainStatus.PENDING_DNS,
  PlatformCustomDomainStatus.ACTIVE,
];

export type DomainEntitlementFlags = {
  hasBasic: boolean;
  hasOrgPack: boolean;
};

export function resolveDomainEntitlements(
  activeModules: readonly string[],
): DomainEntitlementFlags {
  const set = new Set(activeModules);
  return {
    hasBasic: set.has(DOMAIN_BASIC),
    hasOrgPack: set.has(DOMAIN_ORG_PACK),
  };
}

export async function loadDomainEntitlements(
  db: Prisma.TransactionClient | { organizationSubscription: Prisma.OrganizationSubscriptionDelegate },
  organizationId: string,
): Promise<DomainEntitlementFlags> {
  const sub = await db.organizationSubscription.findUnique({
    where: { organizationId },
    select: { activeModules: true },
  });
  return resolveDomainEntitlements(sub?.activeModules ?? []);
}

export async function assertSatelliteLoginHostCreateAllowed(
  db: Prisma.TransactionClient | { platformCustomDomain: Prisma.PlatformCustomDomainDelegate },
  organizationId: string,
  satelliteKey: string,
  entitlements: DomainEntitlementFlags,
): Promise<void> {
  if (!entitlements.hasBasic && !entitlements.hasOrgPack) {
    throw new BadRequestException("platform_domain or platform_domain_org entitlement required");
  }

  const existing = await db.platformCustomDomain.findMany({
    where: {
      organizationId,
      kind: PlatformCustomDomainKind.satellite_login,
      status: { in: ACTIVE_OR_PENDING },
    },
    select: { hostname: true, satelliteKey: true },
  });

  if (entitlements.hasOrgPack) {
    const dup = existing.find((row) => row.satelliteKey === satelliteKey);
    if (dup) {
      throw new ConflictException(
        `A satellite login host already exists for ${satelliteKey} (${dup.hostname})`,
      );
    }
    return;
  }

  if (existing.length >= 1) {
    throw new ConflictException(
      "White-label org pack (platform_domain_org, 29 AZN) is required for additional satellite login hosts. " +
        `Current host: ${existing[0]!.hostname}`,
    );
  }
}

export async function assertDomainPackDowngradeAllowed(
  db: Prisma.TransactionClient | { platformCustomDomain: Prisma.PlatformCustomDomainDelegate },
  organizationId: string,
): Promise<void> {
  const activeLoginHosts = await db.platformCustomDomain.findMany({
    where: {
      organizationId,
      kind: PlatformCustomDomainKind.satellite_login,
      status: PlatformCustomDomainStatus.ACTIVE,
    },
    select: { hostname: true },
    orderBy: { hostname: "asc" },
  });
  if (activeLoginHosts.length <= 1) return;
  const hostnames = activeLoginHosts.map((row) => row.hostname);
  throw new BadRequestException(
    `Cannot downgrade from org pack while ${hostnames.length} ACTIVE satellite login hosts exist. ` +
      `Remove or disable extra hosts first: ${hostnames.join(", ")}`,
  );
}

export { DOMAIN_BASIC, DOMAIN_ORG_PACK };
