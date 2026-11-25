import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  authenticateIndustryStaffLogin,
  describeLoginHostBinding,
  enterSatelliteTenant,
  executeSatelliteSsoExchange,
  expressKitHeaders,
  consumeSsoSignatureOnce,
  resolveVerifiedSsoFinanceRole,
  satelliteRuntimeConfig,
  signSatelliteSession,
  ssoExchangeBodySchema,
} from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-construction-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { grantsForUser } from "@/lib/auth/construction-permission.service";
import { findUserProfileById, findUserWithRoleById } from "@/lib/auth-user.service";
import { isPlatformSuperAdminEdge } from "@/lib/auth/platform-super-admin-edge";
import type { StaffSession } from "@/lib/api-utils";
import { clearStaffAuthCookie, setStaffAuthCookie } from "../../bridge";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { withStaffTenant } from "../tenant";
import { type ConstructionRequest } from "../session";

@Controller("api/auth")
export class AuthController {
  @Get("login")
  async loginHost(@Req() req: ConstructionRequest, @Res() res: Response) {
    res.status(200).json(describeLoginHostBinding(expressKitHeaders(req)));
  }

  @Post("login")
  async login(
    @Req() req: ConstructionRequest,
    @Res() res: Response,
    @Body() _body: unknown,
  ) {
    const auth = await authenticateIndustryStaffLogin({
      headers: expressKitHeaders(req),
      body: req.body,
      prisma,
        isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
      });
      if (!auth.ok) {
        res.status(auth.status).json({ error: auth.error });
        return;
      }
      const found = auth.user;
      const organizationId = auth.organizationId;
      await ensureSystemRoles(prisma, organizationId);
      const user = await findUserWithRoleById(found.id);
      if (!user) {
        res.status(401).json({ error: "Invalid credentials" });
        return;
      }
      const isOwner = user.role.code === OWNER_ROLE_CODE;
      const permissions = grantsForUser({
        login: user.login,
        email: user.email,
        role: user.role,
        isOwner,
      });
      const token = await signSatelliteSession({
        sub: user.id,
        login: user.login,
        email: user.email ?? undefined,
        role: user.role.code,
        fullName: user.fullName,
        organizationId,
        isOwner,
        permissions,
      });
      setStaffAuthCookie(res, token);
      res.status(200).json({
        user: {
          id: user.id,
          login: user.login,
          fullName: user.fullName,
          role: user.role.code,
          organizationId,
          permissions,
        },
        token,
      });
  }

  @Post("logout")
  async logout(@Req() _req: ConstructionRequest, @Res() res: Response) {
    clearStaffAuthCookie(res);
    res.status(200).json({ ok: true });
  }

  @Post("sso/exchange")
  async ssoExchange(
    @Req() req: ConstructionRequest,
    @Res() res: Response,
    @Body() body: unknown,
  ) {
    const parsed = ssoExchangeBodySchema.parse(body);
      if (parsed.expiresAt < Math.floor(Date.now() / 1000)) {
        res.status(401).json({ error: "SSO token expired" });
        return;
      }
      const financeRole = resolveVerifiedSsoFinanceRole({
        email: parsed.email,
        organizationId: parsed.organizationId,
        expiresAt: parsed.expiresAt,
        signature: parsed.signature,
        financeRole: parsed.financeRole,
        jti: parsed.jti,
      });
      if (!financeRole) {
        res.status(401).json({ error: "Invalid SSO signature" });
        return;
      }
      if (!consumeSsoSignatureOnce(parsed.signature, parsed.expiresAt)) {
        res.status(401).json({ error: "SSO ticket already used" });
        return;
      }
      enterSatelliteTenant({ organizationId: parsed.organizationId });
      await ensureSystemRoles(prisma, parsed.organizationId);
      const { user } = await executeSatelliteSsoExchange({ ...parsed, financeRole }, prisma);
      const dbUser = await findUserWithRoleById(user.id);
      if (!dbUser) {
        res.status(500).json({ error: "SSO user missing" });
        return;
      }
      const isOwner = user.isOwner === true || dbUser.role.code === OWNER_ROLE_CODE;
      const permissions = grantsForUser({
        login: dbUser.login,
        email: parsed.email,
        role: dbUser.role,
        isOwner,
      });
      const token = await signSatelliteSession({
        sub: user.id,
        login: user.login,
        email: parsed.email,
        role: dbUser.role.code,
        roles: user.roles,
        fullName: user.fullName,
        organizationId: parsed.organizationId,
        isOwner,
        financeRole: user.financeRole,
        permissions,
      });
      setStaffAuthCookie(res, token);
      res.status(200).json({ user: { ...user, permissions }, token });
  }

  @Get("me")
  @UseGuards(ConstructionStaffGuard)
  me(@Req() req: ConstructionRequest, @Staff() session: StaffSession) {
    return withStaffTenant(req, session, async () => {
      const user = await findUserProfileById(session.sub);
      if (!user) throw new NotFoundException({ error: "User not found" });
      return {
        id: user.id,
        login: user.login,
        email: user.email,
        fullName: user.fullName,
        role: session.role,
        organizationId: session.organizationId,
        organizationName: null,
        permissions: session.permissions,
        isOwner: session.isOwner === true || session.role === OWNER_ROLE_CODE,
        isPlatformSuperAdmin: isPlatformSuperAdminEdge(user),
      };
    });
  }

  @Post("session/refresh-permissions")
  @UseGuards(ConstructionStaffGuard)
  async refreshPermissions(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Res() res: Response,
  ) {
    await withStaffTenant(req, session, async () => {
      await ensureSystemRoles(prisma, session.organizationId);
      const token = await signSatelliteSession({
        sub: session.sub,
        login: session.login,
        email: session.email,
        role: session.role,
        roles: session.roles,
        fullName: session.fullName,
        organizationId: session.organizationId,
        isOwner: session.isOwner === true || session.role === OWNER_ROLE_CODE,
        financeRole: session.financeRole,
        permissions: session.permissions,
      });
      setStaffAuthCookie(res, token);
      res.status(200).json({ ok: true, permissions: session.permissions });
    });
  }
}
