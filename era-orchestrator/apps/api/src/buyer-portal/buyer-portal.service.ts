import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes } from "node:crypto";
import * as bcrypt from "bcrypt";
import { FINANCE_CORE_SATELLITE_KEY } from "../subscription/satellite-keys.constants";
import { PrismaService } from "../prisma/prisma.service";
import type {
  BuyerPortalInviteDto,
  BuyerPortalLoginDto,
  BuyerPortalPickOrgDto,
  BuyerPortalRevokeGrantDto,
  BuyerPortalSetPasswordDto,
} from "./dto/buyer-portal.dto";

const MODULE_KEY = "trade_credit_control";

function isTradeCreditModuleActive(activeModules: string[] | null | undefined): boolean {
  const set = new Set((activeModules ?? []).map((m) => m.trim()).filter(Boolean));
  return set.has(MODULE_KEY);
}

@Injectable()
export class BuyerPortalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: BuyerPortalLoginDto) {
    const email = dto.email.trim().toLowerCase();
    const account = await this.prisma.buyerPortalAccount.findUnique({
      where: { email },
    });
    if (!account?.active) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await bcrypt.compare(dto.password, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const orgs = await this.listActiveOrgs(account.id);
    return {
      accountId: account.id,
      email: account.email,
      fullName: account.fullName ?? account.email.split("@")[0],
      orgs,
    };
  }

  async listActiveOrgs(accountId: string) {
    const grants = await this.prisma.buyerOrgGrant.findMany({
      where: { accountId, revokedAt: null },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            activeModules: true,
            deletedAt: true,
            satelliteEndpoints: {
              where: { satelliteKey: FINANCE_CORE_SATELLITE_KEY, enabled: true },
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
      counterpartyId: string;
      voen: string;
      financeBaseUrl: string | null;
    }> = [];

    for (const g of grants) {
      if (g.organization.deletedAt) continue;
      if (!isTradeCreditModuleActive(g.organization.activeModules)) continue;
      out.push({
        grantId: g.id,
        organizationId: g.organizationId,
        organizationName: g.organization.name,
        counterpartyId: g.financeCounterpartyId,
        voen: g.voen,
        financeBaseUrl:
          g.organization.satelliteEndpoints[0]?.baseUrl ??
          this.fallbackFinanceBaseUrl(),
      });
    }
    return out;
  }

  async pickOrg(accountId: string, email: string, dto: BuyerPortalPickOrgDto) {
    const grant = await this.prisma.buyerOrgGrant.findFirst({
      where: { id: dto.grantId, accountId, revokedAt: null },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            activeModules: true,
            deletedAt: true,
            satelliteEndpoints: {
              where: { satelliteKey: FINANCE_CORE_SATELLITE_KEY, enabled: true },
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
    if (!isTradeCreditModuleActive(grant.organization.activeModules)) {
      throw new UnauthorizedException(
        "Trade credit module not entitled for this organization",
      );
    }
    const secret = this.config.get<string>("ERA_SSO_SHARED_SECRET");
    if (!secret) {
      throw new UnauthorizedException("SSO not configured");
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    const jti = randomBytes(16).toString("hex");
    const payload = `buyer|${email.trim().toLowerCase()}|${grant.organizationId}|${grant.financeCounterpartyId}|${expiresAt}|${jti}`;
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    const baseUrl = (
      grant.organization.satelliteEndpoints[0]?.baseUrl ??
      this.fallbackFinanceBaseUrl()
    )?.replace(/\/$/, "") ?? null;
    const callbackPath = "/buyer/sso/callback";
    const launchUrl = baseUrl
      ? `${baseUrl}${callbackPath}?${new URLSearchParams({
          email: email.trim().toLowerCase(),
          fullName: grant.account.fullName ?? email.split("@")[0] ?? "Buyer",
          organizationId: grant.organizationId,
          counterpartyId: grant.financeCounterpartyId,
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
      counterpartyId: grant.financeCounterpartyId,
      voen: grant.voen,
      expiresAt,
      signature,
      jti,
      financeBaseUrl: baseUrl,
      launchUrl,
    };
  }

  async invite(dto: BuyerPortalInviteDto) {
    const voen = dto.voen.replace(/\D/g, "");
    if (voen.length !== 10) {
      throw new BadRequestException(
        "Buyer VÖEN (10 digits) is required for portal invite",
      );
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true, activeModules: true, deletedAt: true },
    });
    if (!org || org.deletedAt) {
      throw new BadRequestException("Organization not found");
    }
    if (!isTradeCreditModuleActive(org.activeModules)) {
      throw new BadRequestException("trade_credit_control module not entitled");
    }

    const email = dto.email.trim().toLowerCase();
    let account = await this.prisma.buyerPortalAccount.findUnique({ where: { email } });
    let temporaryPassword: string | undefined;
    let createdAccount = false;
    if (!account) {
      temporaryPassword = dto.password?.trim() || randomBytes(9).toString("base64url");
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      account = await this.prisma.buyerPortalAccount.create({
        data: {
          email,
          passwordHash,
          fullName: dto.fullName?.trim() || null,
          active: true,
        },
      });
      createdAccount = true;
    } else if (!account.active) {
      throw new BadRequestException("Buyer portal account is disabled");
    }

    const existing = await this.prisma.buyerOrgGrant.findFirst({
      where: {
        accountId: account.id,
        organizationId: dto.organizationId,
        financeCounterpartyId: dto.financeCounterpartyId,
      },
    });
    let grant;
    if (existing) {
      grant = await this.prisma.buyerOrgGrant.update({
        where: { id: existing.id },
        data: {
          revokedAt: null,
          voen,
        },
      });
    } else {
      grant = await this.prisma.buyerOrgGrant.create({
        data: {
          accountId: account.id,
          organizationId: dto.organizationId,
          voen,
          financeCounterpartyId: dto.financeCounterpartyId,
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

  async setPassword(dto: BuyerPortalSetPasswordDto) {
    const email = dto.email.trim().toLowerCase();
    const account = await this.prisma.buyerPortalAccount.findUnique({ where: { email } });
    if (!account?.active) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await bcrypt.compare(dto.currentPassword, account.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.buyerPortalAccount.update({
      where: { id: account.id },
      data: { passwordHash },
    });
    return { ok: true };
  }

  async revokeGrant(dto: BuyerPortalRevokeGrantDto) {
    const grant = await this.prisma.buyerOrgGrant.findFirst({
      where: { id: dto.grantId, organizationId: dto.organizationId },
    });
    if (!grant) {
      throw new BadRequestException("Grant not found");
    }
    await this.prisma.buyerOrgGrant.update({
      where: { id: grant.id },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private fallbackFinanceBaseUrl(): string | null {
    const raw =
      this.config.get<string>("FINANCE_PUBLIC_URL")?.trim() ||
      this.config.get<string>("FINANCE_WEB_URL")?.trim() ||
      process.env.FINANCE_PUBLIC_URL?.trim() ||
      process.env.FINANCE_WEB_URL?.trim() ||
      process.env.NEXT_PUBLIC_FINANCE_WEB_URL?.trim() ||
      null;
    return raw?.replace(/\/$/, "") ?? null;
  }
}
