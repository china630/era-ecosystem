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
      const accessToken = await this.issueAccessToken({
        sub: user.id,
        email: user.email,
        organizationId: null,
        role: null,
        isSuperAdmin: user.isSuperAdmin,
      });
      return { accessToken, user: { id: user.id, email: user.email } };
    }

    const membership = dto.organizationId
      ? memberships.find(
          (m: { organizationId: string }) =>
            m.organizationId === dto.organizationId,
        )
      : memberships[0];
    if (!membership) {
      throw new UnauthorizedException("Organization access denied");
    }

    const accessToken = await this.issueAccessToken({
      sub: user.id,
      email: user.email,
      organizationId: membership.organizationId,
      role: membership.role,
      isSuperAdmin: user.isSuperAdmin,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        organizationId: membership.organizationId,
        role: membership.role,
      },
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
      return {
        accessToken: await this.issueAccessToken({
          sub: user.id,
          email: user.email,
          organizationId: null,
          role: null,
          isSuperAdmin: user.isSuperAdmin,
        }),
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

    return {
      accessToken: await this.issueAccessToken({
        sub: user.id,
        email: user.email,
        organizationId: m.organizationId,
        role: m.role,
        isSuperAdmin: user.isSuperAdmin,
      }),
    };
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
    const accessToken = await this.issueAccessToken({
      sub: user.id,
      email: user.email,
      organizationId: dto.organizationId,
      role,
      isSuperAdmin: user.isSuperAdmin,
    });
    return { accessToken };
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
          "12h") as any,
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
