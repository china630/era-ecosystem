import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  PlatformCustomDomainKind,
  PlatformCustomDomainStatus,
  Prisma,
} from "@era365/database";
import { promises as dns } from "node:dns";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformEntitlementService } from "../platform-entitlement.service";
import { PlatformAuditService } from "../platform-audit.service";
import { PlatformIdempotencyService } from "../platform-idempotency.service";
import {
  assertSatelliteLoginHostCreateAllowed,
  DOMAIN_BASIC,
  DOMAIN_ORG_PACK,
  loadDomainEntitlements,
} from "./domain-pack-limits";

const PORTAL_ROUTING_TARGET =
  process.env.PLATFORM_DOMAIN_ROUTING_TARGET ?? "portal.era365.az";

const SATELLITE_LOGIN_CNAME_TARGETS: Readonly<Record<string, string>> = {
  industry_clinic: process.env.ERA_CLINIC_POOL_HOST ?? "clinic.era-365.online",
  industry_hotel_pms:
    process.env.ERA_HOTEL_POOL_HOST ?? "hotel-pms.era-365.online",
  industry_fnb_pos: process.env.ERA_FNB_POOL_HOST ?? "fnb-pos.era-365.online",
  industry_retail:
    process.env.ERA_RETAIL_POOL_HOST ?? "retail-pos.era-365.online",
  industry_logistics:
    process.env.ERA_LOGISTICS_POOL_HOST ?? "logistics.era-365.online",
  industry_construction:
    process.env.ERA_CONSTRUCTION_POOL_HOST ?? "construction.era-365.online",
  industry_crm: process.env.ERA_CRM_POOL_HOST ?? "crm.era-365.online",
  industry_auto_service:
    process.env.ERA_AUTO_POOL_HOST ?? "auto-service.era-365.online",
  industry_wholesale:
    process.env.ERA_WHOLESALE_POOL_HOST ?? "wholesale.era-365.online",
  industry_banking: process.env.ERA_BANK_POOL_HOST ?? "bank.era-365.online",
  banking_dbo: process.env.ERA_BANK_DBO_POOL_HOST ?? "dbo.era-365.online",
};

export type CreateDomainInput = {
  hostname: string;
  kind?: "portal" | "satellite_login";
  satelliteKey?: string;
  metadata?: Record<string, unknown>;
};

function normalizeHostname(raw: string): string {
  let host = raw.trim().toLowerCase();
  host = host.replace(/^https?:\/\//, "");
  host = host.replace(/\/.*$/, "");
  host = host.replace(/\.$/, "");
  if (!host || host.length > 253) {
    throw new BadRequestException("Invalid hostname");
  }
  if (
    !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(
      host,
    )
  ) {
    throw new BadRequestException("hostname must be a valid domain name");
  }
  return host;
}

function normalizeDnsTarget(raw: string): string {
  return raw.trim().toLowerCase().replace(/\.$/, "");
}

function routingTargetForKind(
  kind: PlatformCustomDomainKind,
  satelliteKey: string | null | undefined,
): string {
  if (kind === PlatformCustomDomainKind.portal) {
    return PORTAL_ROUTING_TARGET;
  }
  const key = satelliteKey?.trim();
  if (!key) {
    throw new BadRequestException("satelliteKey is required for satellite_login");
  }
  const target = SATELLITE_LOGIN_CNAME_TARGETS[key];
  if (!target) {
    throw new BadRequestException(`Unsupported satelliteKey for login host: ${key}`);
  }
  return target;
}

async function cnamePointsTo(hostname: string, expectedTarget: string): Promise<boolean> {
  const want = normalizeDnsTarget(expectedTarget);
  try {
    const records = await dns.resolveCname(hostname);
    return records.some((r) => normalizeDnsTarget(r) === want);
  } catch {
    return false;
  }
}

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: PlatformEntitlementService,
    private readonly audit: PlatformAuditService,
    private readonly idempotency: PlatformIdempotencyService,
  ) {}

  async createDomain(organizationId: string, body: CreateDomainInput) {
    await this.entitlement.assertAnyPlatformModule(organizationId, [
      DOMAIN_BASIC,
      DOMAIN_ORG_PACK,
    ]);

    const hostname = normalizeHostname(body.hostname);
    const kind =
      body.kind === "satellite_login"
        ? PlatformCustomDomainKind.satellite_login
        : PlatformCustomDomainKind.portal;
    const satelliteKey =
      kind === PlatformCustomDomainKind.satellite_login
        ? body.satelliteKey?.trim() || null
        : null;

    if (kind === PlatformCustomDomainKind.satellite_login && !satelliteKey) {
      throw new BadRequestException("satelliteKey is required for satellite_login");
    }

    const existingGlobal = await this.prisma.platformCustomDomain.findUnique({
      where: { hostname },
    });
    if (existingGlobal) {
      throw new ConflictException("Hostname already registered");
    }

    const entitlements = await loadDomainEntitlements(this.prisma, organizationId);
    if (kind === PlatformCustomDomainKind.satellite_login) {
      await assertSatelliteLoginHostCreateAllowed(
        this.prisma,
        organizationId,
        satelliteKey!,
        entitlements,
      );
    }

    const routingTarget = routingTargetForKind(kind, satelliteKey);
    const domain = await this.prisma.platformCustomDomain.create({
      data: {
        organizationId,
        hostname,
        kind,
        satelliteKey,
        status: PlatformCustomDomainStatus.PENDING_DNS,
        metadata: (body.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    const entitlementSlug = entitlements.hasOrgPack ? DOMAIN_ORG_PACK : DOMAIN_BASIC;
    await this.audit.log({
      organizationId,
      addonSlug: entitlementSlug,
      action: "domain.created",
      payload: { hostname, kind, satelliteKey },
    });
    return {
      id: domain.id,
      hostname: domain.hostname,
      kind: domain.kind,
      satelliteKey: domain.satelliteKey,
      status: domain.status,
      dnsHint: `CNAME ${hostname} → ${routingTarget}`,
      mode: "live",
    };
  }

  async activateDomain(organizationId: string, domainId: string) {
    await this.entitlement.assertAnyPlatformModule(organizationId, [
      DOMAIN_BASIC,
      DOMAIN_ORG_PACK,
    ]);

    const domain = await this.prisma.platformCustomDomain.findFirst({
      where: { id: domainId, organizationId },
    });
    if (!domain) {
      throw new NotFoundException("Domain not found");
    }
    if (domain.status === PlatformCustomDomainStatus.ACTIVE) {
      return {
        id: domain.id,
        hostname: domain.hostname,
        status: domain.status,
        mode: "live",
      };
    }
    if (domain.status === PlatformCustomDomainStatus.DISABLED) {
      throw new BadRequestException("Domain is disabled");
    }

    const routingTarget = routingTargetForKind(domain.kind, domain.satelliteKey);
    const ok = await cnamePointsTo(domain.hostname, routingTarget);
    if (!ok) {
      throw new BadRequestException(
        `DNS CNAME for ${domain.hostname} must point to ${routingTarget} before activation`,
      );
    }

    const updated = await this.prisma.platformCustomDomain.update({
      where: { id: domain.id },
      data: { status: PlatformCustomDomainStatus.ACTIVE },
    });

    await this.audit.log({
      organizationId,
      addonSlug: DOMAIN_BASIC,
      action: "domain.activated",
      payload: { hostname: updated.hostname, kind: updated.kind },
    });

    return {
      id: updated.id,
      hostname: updated.hostname,
      kind: updated.kind,
      satelliteKey: updated.satelliteKey,
      status: updated.status,
      mode: "live",
    };
  }

  async resolveTenant(hostname: string) {
    this.idempotency.assertLiveMode();
    const host = normalizeHostname(hostname);
    const domain = await this.prisma.platformCustomDomain.findFirst({
      where: { hostname: host, status: PlatformCustomDomainStatus.ACTIVE },
    });
    if (!domain) {
      throw new BadRequestException("Tenant not found for hostname");
    }
    return {
      organizationId: domain.organizationId,
      hostname: domain.hostname,
      kind: domain.kind,
      satelliteKey: domain.satelliteKey,
      routingTarget: routingTargetForKind(domain.kind, domain.satelliteKey),
      mode: "live",
    };
  }
}
