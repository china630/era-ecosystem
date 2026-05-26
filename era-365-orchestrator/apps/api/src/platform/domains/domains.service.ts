import {
  BadRequestException,
  ConflictException,
  Injectable,
} from "@nestjs/common";
import { PlatformCustomDomainStatus, Prisma } from "@era365/database";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformEntitlementService } from "../platform-entitlement.service";

const ENTITLEMENT = "platform_domain";

export type CreateDomainInput = {
  hostname: string;
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
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    throw new BadRequestException("hostname must be a valid domain name");
  }
  return host;
}

@Injectable()
export class DomainsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: PlatformEntitlementService,
  ) {}

  async createDomain(organizationId: string, body: CreateDomainInput) {
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);

    const hostname = normalizeHostname(body.hostname);

    const existing = await this.prisma.platformCustomDomain.findUnique({
      where: {
        organizationId_hostname: { organizationId, hostname },
      },
    });
    if (existing) {
      throw new ConflictException("Domain already registered for organization");
    }

    const domain = await this.prisma.platformCustomDomain.create({
      data: {
        organizationId,
        hostname,
        status: PlatformCustomDomainStatus.PENDING_DNS,
        metadata: (body.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });

    return {
      id: domain.id,
      hostname: domain.hostname,
      status: domain.status,
      dnsHint: `CNAME ${hostname} → portal.era365.az`,
    };
  }
}
