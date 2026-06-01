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
import { PlatformAuditService } from "../platform-audit.service";
import { PlatformIdempotencyService } from "../platform-idempotency.service";

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
    private readonly audit: PlatformAuditService,
    private readonly idempotency: PlatformIdempotencyService,
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
    await this.audit.log({
      organizationId,
      addonSlug: ENTITLEMENT,
      action: "portal.link.created",
      payload: { entityType: body.entityType, entityId: body.entityId },
    });
    return {
      id: link.id,
      token: link.token,
      url: `${publicBase}/portal/${link.token}`,
      expiresAt: link.expiresAt,
      mode: "live",
    };
  }

  async listDocuments(organizationId: string, customerRef?: string) {
    this.idempotency.assertLiveMode();
    await this.entitlement.assertPlatformModule(organizationId, ENTITLEMENT);
    const links = await this.prisma.platformPortalLink.findMany({
      where: { organizationId, status: PlatformPortalLinkStatus.ACTIVE },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const filtered = customerRef
      ? links.filter((l) => {
          const m = l.metadata as Record<string, unknown> | null;
          return m?.customerRef === customerRef;
        })
      : links;
    return {
      documents: filtered.map((l) => ({
        id: l.id,
        entityType: l.entityType,
        entityId: l.entityId,
        expiresAt: l.expiresAt,
        metadata: l.metadata,
      })),
      mode: "live",
    };
  }

  async createSession(token: string, pin?: string) {
    this.idempotency.assertLiveMode();
    const link = await this.getLink(token);
    const expectedPin =
      typeof link.metadata === "object" &&
      link.metadata &&
      "pin" in (link.metadata as Record<string, unknown>)
        ? String((link.metadata as Record<string, unknown>).pin)
        : null;
    if (expectedPin && expectedPin !== pin) {
      throw new BadRequestException("Invalid portal session PIN");
    }
    const sessionToken = randomBytes(16).toString("hex");
    return {
      sessionToken,
      organizationId: link.organizationId,
      entityType: link.entityType,
      entityId: link.entityId,
      mode: "live",
    };
  }
}