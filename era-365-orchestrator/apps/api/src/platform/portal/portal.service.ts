import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PlatformPortalLinkStatus } from "@era365/database";
import { randomBytes } from "crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PlatformEntitlementService } from "../platform-entitlement.service";

const ENTITLEMENT = "platform_portal";

export type CreatePortalLinkInput = {
  entityType: string;
  entityId: string;
  expiresInHours?: number;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class PortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlement: PlatformEntitlementService,
    private readonly config: ConfigService,
  ) {}

  async getLink(token: string) {
    const link = await this.prisma.platformPortalLink.findUnique({
      where: { token },
    });
    if (!link || link.status !== PlatformPortalLinkStatus.ACTIVE) {
      throw new NotFoundException("Portal link not found");
    }
    if (link.expiresAt && link.expiresAt < new Date()) {
      throw new BadRequestException("Portal link expired");
    }
    return {
      entityType: link.entityType,
      entityId: link.entityId,
      organizationId: link.organizationId,
      metadata: link.metadata,
    };
  }

  async createLink(organizationId: string, body: CreatePortalLinkInput) {
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);
    const token = randomBytes(24).toString("hex");
    const expiresAt =
      body.expiresInHours != null
        ? new Date(Date.now() + body.expiresInHours * 3600_000)
        : new Date(Date.now() + 168 * 3600_000);
    const link = await this.prisma.platformPortalLink.create({
      data: {
        organizationId,
        token,
        entityType: body.entityType,
        entityId: body.entityId,
        expiresAt,
        status: PlatformPortalLinkStatus.ACTIVE,
        metadata: (body.metadata ?? {}) as object,
      },
    });
    const publicBase = this.config
      .get<string>("WEB_APP_PUBLIC_URL", "http://localhost:3000")
      .replace(/\/$/, "");
    return {
      id: link.id,
      token: link.token,
      url: `${publicBase}/portal/${link.token}`,
      expiresAt: link.expiresAt,
    };
  }
}