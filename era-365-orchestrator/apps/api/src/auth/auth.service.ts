import {
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHmac, timingSafeEqual } from "crypto";
import type { UserRole } from "@era365/database";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";
import type { LoginDto } from "./dto/login.dto";
import type { SsoExchangeDto } from "./dto/sso-exchange.dto";
import type { EraJwtPayload } from "./jwt-payload.type";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: ControlPlanePrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId: user.id, deletedAt: null },
      orderBy: { joinedAt: "asc" },
    });

    if (memberships.length === 0) {
      const claims = await this.buildClaims({
        sub: user.id,
        email: user.email,
        organizationId: null,
        role: null,
        isSuperAdmin: user.isSuperAdmin,
      });
      const accessToken = await this.issueAccessToken(claims);
      const refreshToken = await this.issueRefreshToken(user.id, null);
      return {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email },
        claims,
      };
    }

    const membership = dto.organizationId
      ? memberships.find((m) => m.organizationId === dto.organizationId)
      : memberships[0];
    if (!membership) {
      throw new UnauthorizedException("Organization access denied");
    }

    const claims = await this.buildClaims({
      sub: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      role: membership.role,
      isSuperAdmin: user.isSuperAdmin,
    });
    const accessToken = await this.issueAccessToken(claims);
    const refreshToken = await this.issueRefreshToken(
      user.id,
      membership.organizationId,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        organizationId: membership.organizationId,
        role: membership.role,
        roles: claims.roles,
        isOwner: claims.isOwner,
      },
      claims,
    };
  }

  async refresh(refreshToken: string) {
    const refreshSecret =
      this.config.get<string>("ERA_JWT_REFRESH_SECRET") ??
      this.config.get<string>("ERA_JWT_SECRET");
    if (!refreshSecret) {
      throw new UnauthorizedException("Refresh not configured");
    }
    let payload: { sub: string; typ?: string; organizationId?: string | null };
    try {
      payload = await this.jwt.verifyAsync(refreshToken, {
        secret: refreshSecret,
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }
    if (payload.typ !== "refresh") {
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    if (!payload.organizationId) {
      const claims = await this.buildClaims({
        sub: user.id,
        email: user.email,
        organizationId: null,
        role: null,
        isSuperAdmin: user.isSuperAdmin,
      });
      return {
        accessToken: await this.issueAccessToken(claims),
        claims,
      };
    }

    const m = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: payload.organizationId,
        },
      },
    });
    if (!m || m.deletedAt) {
      throw new UnauthorizedException("Organization access revoked");
    }

    const claims = await this.buildClaims({
      sub: user.id,
      email: user.email,
      organizationId: m.organizationId,
      role: m.role,
      isSuperAdmin: user.isSuperAdmin,
    });
    return {
      accessToken: await this.issueAccessToken(claims),
      claims,
    };
  }

  async switchOrganization(userId: string, organizationId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");

    const m = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: { userId, organizationId },
      },
    });
    if (!m || m.deletedAt) {
      throw new UnauthorizedException("Organization access denied");
    }

    const claims = await this.buildClaims({
      sub: user.id,
      email: user.email,
      organizationId: m.organizationId,
      role: m.role,
      isSuperAdmin: user.isSuperAdmin,
    });
    const accessToken = await this.issueAccessToken(claims);
    const refreshToken = await this.issueRefreshToken(user.id, organizationId);
    return { accessToken, refreshToken, claims };
  }

  async listMemberships(userId: string) {
    const rows = await this.prisma.organizationMembership.findMany({
      where: { userId, deletedAt: null },
      orderBy: { joinedAt: "asc" },
    });
    const orgIds = rows.map((r) => r.organizationId);
    const orgs =
      orgIds.length > 0
        ? await this.prisma.organization.findMany({
            where: { id: { in: orgIds } },
            select: { id: true, name: true, ownerId: true },
          })
        : [];
    const orgMap = new Map(orgs.map((o) => [o.id, o]));
    return rows.map((m) => {
      const org = orgMap.get(m.organizationId);
      return {
        organizationId: m.organizationId,
        organizationName: org?.name ?? null,
        role: m.role,
        isOwner: org?.ownerId === userId,
        joinedAt: m.joinedAt,
      };
    });
  }

  async ssoExchange(dto: SsoExchangeDto) {
    const secret = this.config.get<string>("ERA_SSO_SHARED_SECRET");
    if (!secret) {
      throw new UnauthorizedException("SSO not configured");
    }
    const payload = `${dto.email}|${dto.organizationId}|${dto.expiresAt}`;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const sigBuf = Buffer.from(dto.signature, "hex");
    const expBuf = Buffer.from(expected, "hex");
    if (
      sigBuf.length !== expBuf.length ||
      !timingSafeEqual(sigBuf, expBuf) ||
      Date.now() > dto.expiresAt
    ) {
      throw new UnauthorizedException("Invalid SSO signature");
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const m = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: dto.organizationId,
        },
      },
    });
    if (!m || m.deletedAt) {
      throw new UnauthorizedException("Organization access denied");
    }

    const role = (dto.role as UserRole | undefined) ?? m.role;
    const claims = await this.buildClaims({
      sub: user.id,
      email: user.email,
      organizationId: dto.organizationId,
      role,
      isSuperAdmin: user.isSuperAdmin,
    });
    const accessToken = await this.issueAccessToken(claims);
    return { accessToken, claims, financeRole: role };
  }

  verifyAccessToken(token: string): Promise<EraJwtPayload> {
    const issuer =
      this.config.get<string>("ERA_JWT_ISSUER") ?? "era-365-orchestrator";
    const audience =
      this.config.get<string>("ERA_JWT_AUDIENCE_FINANCE") ??
      "era-finance-core";
    return this.jwt.verifyAsync<EraJwtPayload>(token, {
      issuer,
      audience,
      algorithms: ["HS256"],
    });
  }

  private async buildClaims(input: {
    sub: string;
    email: string;
    organizationId: string | null;
    role: UserRole | null;
    isSuperAdmin: boolean;
  }): Promise<EraJwtPayload> {
    let isOwner = false;
    if (input.organizationId && input.role === "OWNER") {
      isOwner = true;
    } else if (input.organizationId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: input.organizationId },
        select: { ownerId: true },
      });
      isOwner = org?.ownerId === input.sub;
    }
    const roles = input.role ? [input.role] : [];
    return {
      sub: input.sub,
      email: input.email,
      organizationId: input.organizationId,
      role: input.role,
      roles,
      isOwner,
      isSuperAdmin: input.isSuperAdmin,
    };
  }

  issueAccessToken(claims: EraJwtPayload): Promise<string> {
    const issuer =
      this.config.get<string>("ERA_JWT_ISSUER") ?? "era-365-orchestrator";
    const audience =
      this.config.get<string>("ERA_JWT_AUDIENCE_FINANCE") ??
      "era-finance-core";
    return this.jwt.signAsync(
      { ...claims },
      {
        issuer,
        audience,
        algorithm: "HS256",
        expiresIn: (this.config.get<string>("ERA_JWT_ACCESS_EXPIRES") ??
          "12h") as `${number}h`,
      },
    );
  }

  issueRefreshToken(
    userId: string,
    organizationId: string | null,
  ): Promise<string> {
    const refreshSecret =
      this.config.get<string>("ERA_JWT_REFRESH_SECRET") ??
      this.config.get<string>("ERA_JWT_SECRET");
    if (!refreshSecret) {
      throw new UnauthorizedException("Refresh not configured");
    }
    return this.jwt.signAsync(
      { sub: userId, organizationId, typ: "refresh" },
      {
        secret: refreshSecret,
        expiresIn: (this.config.get<string>("ERA_JWT_REFRESH_EXPIRES") ??
          "7d") as `${number}d`,
      },
    );
  }

  jwksStub() {
    return {
      keys: [],
      note: "RS256 JWKS — phase A+; HS256 shared secret in use",
    };
  }
}
