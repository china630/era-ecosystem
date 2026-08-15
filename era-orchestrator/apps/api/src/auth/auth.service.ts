import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcrypt";
import { createHmac, createPublicKey, randomUUID, timingSafeEqual } from "crypto";
import { UserRole } from "@era365/database";
import { MdmService } from "../mdm/mdm.service";
import { ControlPlanePrismaService } from "../prisma/control-plane-prisma.service";
import { ReferralsService } from "../referrals/referrals.service";
import { TrialProvisionService } from "../subscription/trial-provision.service";
import { encryptText } from "../common/utils/mdm-crypto.util";
import type { LoginDto } from "./dto/login.dto";
import type { RegisterUserDto } from "./dto/register-user.dto";
import type { SsoExchangeDto } from "./dto/sso-exchange.dto";
import type { EraJwtPayload } from "./jwt-payload.type";
import { resolvePermissionsForRole } from "./role-permissions";
import {
  accessTokenSignOptions,
  jwksPublicKeys,
  parseRs256Jwk,
  resolveJwtSigningMode,
} from "./jwt-signing.util";
import { HandoffTicketStore } from "./handoff-ticket.store";

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: ControlPlanePrismaService,
    private readonly mdm: MdmService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly referrals: ReferralsService,
    private readonly trialProvision: TrialProvisionService,
    private readonly handoffTickets: HandoffTicketStore,
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

  async registerOrganizationForUser(
    userId: string,
    body: { name: string; taxId: string; referralCode?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("User not found");
    const { organizationId } = await this.mdm.registerOrganization({
      name: body.name,
      taxId: body.taxId,
      ownerUserId: userId,
    });
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { createdAt: true },
    });
    if (org) {
      await this.trialProvision.provisionOrgTrial(organizationId, org.createdAt);
    }
    if (body.referralCode?.trim()) {
      const orgFull = await this.prisma.organization.findUnique({
        where: { id: organizationId },
      });
      if (orgFull) {
        await this.prisma.$transaction(async (tx) => {
          await this.referrals.attachReferralOnSignupTx(tx, {
            organizationId,
            organizationCreatedAt: orgFull.createdAt,
            referralCode: body.referralCode,
          });
        });
      }
    }
    await this.prisma.organizationMembership.upsert({
      where: {
        userId_organizationId: { userId, organizationId },
      },
      create: {
        userId,
        organizationId,
        role: UserRole.OWNER,
      },
      update: { deletedAt: null, role: UserRole.OWNER },
    });
    return this.switchOrganization(userId, organizationId);
  }

  async registerUser(dto: RegisterUserDto) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("Email already registered");
    }
    const fn = dto.firstName.trim();
    const ln = dto.lastName.trim();
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        firstNameCipher: encryptText(fn),
        lastNameCipher: encryptText(ln),
      },
    });
    const claims = await this.buildClaims({
      sub: user.id,
      email: user.email,
      organizationId: null,
      role: null,
      isSuperAdmin: user.isSuperAdmin,
    });
    const accessToken = await this.issueAccessToken(claims);
    const refreshToken = await this.issueRefreshToken(user.id, null);
    const memberships = await this.listMemberships(user.id);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, organizationId: null },
      claims,
      memberships,
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

  async verifyAccessToken(token: string): Promise<EraJwtPayload> {
    const issuer =
      this.config.get<string>("ERA_JWT_ISSUER") ?? "era-orchestrator";
    const audience =
      this.config.get<string>("ERA_JWT_AUDIENCE_FINANCE") ??
      "era-finance-core";
    const mode = resolveJwtSigningMode(this.config);
    const opts = { issuer, audience } as const;

    if (mode !== "rs256") {
      const secret =
        this.config.get<string>("ERA_JWT_SECRET") ??
        this.config.get<string>("JWT_SECRET") ??
        "";
      if (secret) {
        try {
          return await this.jwt.verifyAsync<EraJwtPayload>(token, {
            ...opts,
            algorithms: ["HS256"],
            secret,
          });
        } catch (err) {
          if (mode === "hs256") throw err;
        }
      } else if (mode === "hs256") {
        throw new UnauthorizedException("JWT secret not configured");
      }
    }

    const jwk = parseRs256Jwk(this.config);
    if (!jwk) {
      throw new UnauthorizedException("Invalid or expired token");
    }
    try {
      // Nest JwtService maps signing/verify material from `secret`; `publicKey`
      // on options is ignored and HS256 module secret is used → RS256 verify 401.
      const publicKeyPem = createPublicKey({ key: jwk, format: "jwk" }).export({
        type: "spki",
        format: "pem",
      });
      return await this.jwt.verifyAsync<EraJwtPayload>(token, {
        ...opts,
        algorithms: ["RS256"],
        secret: publicKeyPem,
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
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
    const permissions = resolvePermissionsForRole(input.role, {
      isSuperAdmin: input.isSuperAdmin,
    });
    return {
      sub: input.sub,
      email: input.email,
      organizationId: input.organizationId,
      role: input.role,
      roles,
      permissions,
      isOwner,
      isSuperAdmin: input.isSuperAdmin,
    };
  }

  issueAccessToken(claims: EraJwtPayload): Promise<string> {
    const issuer =
      this.config.get<string>("ERA_JWT_ISSUER") ?? "era-orchestrator";
    const audience =
      this.config.get<string>("ERA_JWT_AUDIENCE_FINANCE") ??
      "era-finance-core";
    const sign = accessTokenSignOptions(this.config);
    const expiresIn = (this.config.get<string>("ERA_JWT_ACCESS_EXPIRES") ??
      "12h") as `${number}h`;
    if (sign.algorithm === "RS256" && sign.privateKey) {
      // Nest JwtService reads the signing material from `secret`; KeyObject in
      // `privateKey` is ignored and the HS256 module secret is used → RS256 fails.
      const privateKeyPem = sign.privateKey.export({
        type: "pkcs8",
        format: "pem",
      });
      return this.jwt.signAsync(
        { ...claims },
        {
          issuer,
          audience,
          algorithm: "RS256",
          secret: privateKeyPem,
          keyid: sign.keyid,
          expiresIn,
        },
      );
    }
    return this.jwt.signAsync(
      { ...claims },
      {
        issuer,
        audience,
        algorithm: "HS256",
        secret: sign.secret,
        expiresIn,
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
    const { keys } = jwksPublicKeys(this.config);
    if (keys.length > 0) return { keys };
    return {
      keys: [],
      note: "RS256 JWKS — set ERA_JWT_RS256_JWK + ERA_JWT_SIGNING_MODE=rs256|dual",
    };
  }

  async createFinanceHandoffTicket(input: {
    userId: string;
    organizationId: string | null;
  }): Promise<{ ticket: string; expiresAt: string }> {
    const ticket = `fh_${randomUUID().replace(/-/g, "")}`;
    const expiresAt = Date.now() + 60_000;
    await this.handoffTickets.put(ticket, {
      userId: input.userId,
      organizationId: input.organizationId,
    });
    return { ticket, expiresAt: new Date(expiresAt).toISOString() };
  }

  /**
   * Mint a signed satellite SSO launch ticket. The HMAC secret stays server-side;
   * the launcher only assembles the `/sso/callback` URL from these fields. Mirrors
   * the payload verified by each satellite's `POST /api/auth/sso/exchange`.
   */
  /**
   * SEC-SSO-02 / SEC-SSO-03: mint only for active membership; HMAC covers financeRole (v2).
   */
  async createSatelliteSsoTicket(input: {
    userId: string;
    email: string;
    organizationId: string | null;
    role: string | null;
  }): Promise<{
    email: string;
    fullName: string;
    organizationId: string;
    expiresAt: number;
    signature: string;
    financeRole: string;
  }> {
    const secret = this.config.get<string>("ERA_SSO_SHARED_SECRET");
    if (!secret) {
      throw new UnauthorizedException("SSO not configured");
    }
    if (!input.organizationId) {
      throw new UnauthorizedException("No active organization for SSO launch");
    }
    const membership = await this.prisma.organizationMembership.findFirst({
      where: {
        userId: input.userId,
        organizationId: input.organizationId,
      },
    });
    if (!membership) {
      throw new UnauthorizedException("Not a member of the requested organization");
    }
    const financeRole = String(membership.role);
    const expiresAt = Math.floor(Date.now() / 1000) + 300;
    // v2 payload includes role so satellites cannot escalate via query rewrite
    const payload = `${input.email}|${input.organizationId}|${expiresAt}|${financeRole}`;
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    return {
      email: input.email,
      fullName: input.email.split("@")[0] ?? "User",
      organizationId: input.organizationId,
      expiresAt,
      signature,
      financeRole,
    };
  }

  async redeemFinanceHandoffTicket(ticket: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const row = await this.handoffTickets.take(ticket);
    const user = await this.prisma.user.findUnique({
      where: { id: row.userId },
    });
    if (!user) throw new UnauthorizedException("User not found");
    const membership = row.organizationId
      ? await this.prisma.organizationMembership.findFirst({
          where: {
            userId: row.userId,
            organizationId: row.organizationId,
            deletedAt: null,
          },
        })
      : null;
    const claims = await this.buildClaims({
      sub: user.id,
      email: user.email,
      organizationId: row.organizationId,
      role: membership?.role ?? null,
      isSuperAdmin: user.isSuperAdmin,
    });
    const accessToken = await this.issueAccessToken(claims);
    const refreshToken = await this.issueRefreshToken(
      user.id,
      row.organizationId,
    );
    return { accessToken, refreshToken };
  }
}
