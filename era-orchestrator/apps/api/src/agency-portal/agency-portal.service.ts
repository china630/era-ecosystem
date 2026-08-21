import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes } from "node:crypto";
import * as bcrypt from "bcrypt";
import { isHotelModuleActive } from "@era365/database";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AgencyPortalInviteDto,
  AgencyPortalLoginDto,
  AgencyPortalPickPropertyDto,
  AgencyPortalRevokeGrantDto,
  AgencyPortalSetPasswordDto,
} from "./dto/agency-portal.dto";

const HOTEL_KEY = "industry_hotel_pms";
const MODULE_KEY = "hotel_agency_portal";

@Injectable()
export class AgencyPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: AgencyPortalLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const account = await this.prisma.agencyPortalAccount.findUnique({
      where: { email },
    });
    if (!account?.active) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await bcrypt.compare(dto.password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const properties = await this.listActiveProperties(account.id);
    return {
      accountId: account.id,
      email: account.email,
      fullName: account.fullName ?? account.email.split("@")[0],
      properties,
    };
  }

  async listActiveProperties(accountId: string) {
    const grants = await this.prisma.agencyPropertyGrant.findMany({
      where: { accountId, revokedAt: null },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            activeModules: true,
            deletedAt: true,
            satelliteEndpoints: {
              where: { satelliteKey: HOTEL_KEY, enabled: true },
              select: { baseUrl: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const out: Array<{
      grantId: string;
      organizationId: string;
      organizationName: string;
      agencyId: string;
      agencyCode: string | null;
      agencyVoen: string;
      hotelBaseUrl: string | null;
    }> = [];

    for (const g of grants) {
      if (g.organization.deletedAt) continue;
      const modules = g.organization.activeModules ?? [];
      if (!isHotelModuleActive(modules, MODULE_KEY)) continue;
      out.push({
        grantId: g.id,
        organizationId: g.organizationId,
        organizationName: g.organization.name,
        agencyId: g.localAgencyId,
        agencyCode: g.localAgencyCode,
        agencyVoen: g.agencyVoen,
        hotelBaseUrl: g.organization.satelliteEndpoints[0]?.baseUrl ?? null,
      });
    }
    return out;
  }

  async pickProperty(accountId: string, email: string, dto: AgencyPortalPickPropertyDto) {
    const grant = await this.prisma.agencyPropertyGrant.findFirst({
      where: { id: dto.grantId, accountId, revokedAt: null },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            activeModules: true,
            deletedAt: true,
            satelliteEndpoints: {
              where: { satelliteKey: HOTEL_KEY, enabled: true },
              select: { baseUrl: true },
              take: 1,
            },
          },
        },
        account: { select: { fullName: true, email: true, active: true } },
      },
    });
    if (!grant || !grant.account.active || grant.organization.deletedAt) {
      throw new UnauthorizedException("Grant not found or revoked");
    }
    const modules = grant.organization.activeModules ?? [];
    if (!isHotelModuleActive(modules, MODULE_KEY)) {
      throw new UnauthorizedException("Agency portal module not entitled for this hotel");
    }
    const secret = this.config.get<string>("ERA_SSO_SHARED_SECRET");
    if (!secret) {
      throw new UnauthorizedException("SSO not configured");
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const jti = randomBytes(16).toString("hex");
    const payload = `agency|${email.trim().toLowerCase()}|${grant.organizationId}|${grant.localAgencyId}|${expiresAt}|${jti}`;
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    const baseUrl = grant.organization.satelliteEndpoints[0]?.baseUrl?.replace(/\/$/, "") ?? null;
    const callbackPath = "/agency/sso/callback";
    const launchUrl = baseUrl
      ? `${baseUrl}${callbackPath}?${new URLSearchParams({
          email: email.trim().toLowerCase(),
          fullName: grant.account.fullName ?? email.split("@")[0] ?? "Agency",
          organizationId: grant.organizationId,
          agencyId: grant.localAgencyId,
          expiresAt: String(expiresAt),
          signature,
          jti,
        }).toString()}`
      : null;
    return {
      email: email.trim().toLowerCase(),
      fullName: grant.account.fullName ?? email.split("@")[0],
      organizationId: grant.organizationId,
      organizationName: grant.organization.name,
      agencyId: grant.localAgencyId,
      agencyCode: grant.localAgencyCode,
      expiresAt,
      signature,
      jti,
      hotelBaseUrl: baseUrl,
      launchUrl,
    };
  }

  async invite(dto: AgencyPortalInviteDto) {
    const voen = dto.agencyVoen.replace(/\D/g, "");
    if (voen.length !== 10) {
      throw new BadRequestException("Agency VÖEN (10 digits) is required for portal invite");
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true, activeModules: true, deletedAt: true },
    });
    if (!org || org.deletedAt) {
      throw new BadRequestException("Organization not found");
    }
    const modules = org.activeModules ?? [];
    if (!isHotelModuleActive(modules, MODULE_KEY)) {
      throw new BadRequestException("hotel_agency_portal module not entitled");
    }

    const email = dto.email.trim().toLowerCase();
    let account = await this.prisma.agencyPortalAccount.findUnique({ where: { email } });
    let temporaryPassword: string | undefined;
    let createdAccount = false;
    if (!account) {
      temporaryPassword = dto.password?.trim() || randomBytes(9).toString("base64url");
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      account = await this.prisma.agencyPortalAccount.create({
        data: {
          email,
          passwordHash,
          fullName: dto.fullName?.trim() || null,
          active: true,
        },
      });
      createdAccount = true;
    } else if (!account.active) {
      throw new BadRequestException("Agency portal account is disabled");
    }

    const existing = await this.prisma.agencyPropertyGrant.findFirst({
      where: {
        accountId: account.id,
        organizationId: dto.organizationId,
        localAgencyId: dto.localAgencyId,
      },
    });
    let grant;
    if (existing) {
      grant = await this.prisma.agencyPropertyGrant.update({
        where: { id: existing.id },
        data: {
          revokedAt: null,
          agencyVoen: voen,
          localAgencyCode: dto.localAgencyCode ?? existing.localAgencyCode,
        },
      });
    } else {
      grant = await this.prisma.agencyPropertyGrant.create({
        data: {
          accountId: account.id,
          organizationId: dto.organizationId,
          agencyVoen: voen,
          localAgencyId: dto.localAgencyId,
          localAgencyCode: dto.localAgencyCode ?? null,
        },
      });
    }

    return {
      accountId: account.id,
      email: account.email,
      grantId: grant.id,
      createdAccount,
      temporaryPassword: createdAccount ? temporaryPassword : undefined,
    };
  }

  async setPassword(dto: AgencyPortalSetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const account = await this.prisma.agencyPortalAccount.findUnique({ where: { email } });
    if (!account?.active) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await bcrypt.compare(dto.currentPassword, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.agencyPortalAccount.update({
      where: { id: account.id },
      data: { passwordHash },
    });
    return { ok: true };
  }

  async revokeGrant(dto: AgencyPortalRevokeGrantDto) {
    const grant = await this.prisma.agencyPropertyGrant.findFirst({
      where: { id: dto.grantId, organizationId: dto.organizationId },
    });
    if (!grant) {
      throw new BadRequestException("Grant not found");
    }
    await this.prisma.agencyPropertyGrant.update({
      where: { id: grant.id },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
}
