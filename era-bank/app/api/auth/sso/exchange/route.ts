import {
  authCookieName,
  buildSsoPayload,
  isPlatformSuperAdminUser,
  mapFinanceRoleToSatellite,
  SATELLITE_ROLE,
  signSatelliteSession,
  ssoExchangeBodySchema,
  verifySsoSignature,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const DEMO_BRANCH_ID = "demo-branch-hq";

export async function POST(request: Request) {
  try {
    const body = ssoExchangeBodySchema.parse(await request.json());
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return jsonError("SSO token expired", 401);
    }

    const expectedOrg =
      process.env.ERA_BANK_ORGANIZATION_ID ??
      process.env.ERA_SATELLITE_ORGANIZATION_ID;
    if (expectedOrg && body.organizationId !== expectedOrg) {
      return jsonError("Organization mismatch", 403);
    }

    const payload = buildSsoPayload(
      body.email,
      body.organizationId,
      body.expiresAt,
    );
    if (!verifySsoSignature(payload, body.signature)) {
      return jsonError("Invalid SSO signature", 401);
    }

    // Platform super-admins get full bank ops access (BUSINESS_OWNER + approve),
    // regardless of their finance membership role.
    const isPlatformSuperAdmin = isPlatformSuperAdminUser({
      email: body.email,
      login: body.email,
    });
    const satelliteRole = isPlatformSuperAdmin
      ? SATELLITE_ROLE.BUSINESS_OWNER
      : mapFinanceRoleToSatellite(body.financeRole ?? "USER");
    const isOwner = satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER;
    const roleName = isOwner ? "Business Owner" : "Executive viewer";
    const limitsJson = { readOnly: !isOwner, canApprove: isOwner };

    const role = await prisma.opsRole.upsert({
      where: { code: satelliteRole },
      update: { name: roleName, limitsJson },
      create: {
        code: satelliteRole,
        name: roleName,
        limitsJson,
      },
    });

    const username = `sso_${body.email.split("@")[0]}`;
    const user = await prisma.opsUser.upsert({
      where: { username },
      update: {
        fullName: body.fullName,
        passwordHash: "sso:no-password",
        branchId: DEMO_BRANCH_ID,
        opsRoleId: role.id,
        status: "ACTIVE",
      },
      create: {
        username,
        fullName: body.fullName,
        passwordHash: "sso:no-password",
        branchId: DEMO_BRANCH_ID,
        opsRoleId: role.id,
        status: "ACTIVE",
      },
      include: { opsRole: true },
    });

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.username,
      email: body.email,
      role: user.opsRole.code,
      fullName: user.fullName,
      isOwner,
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.username,
        fullName: user.fullName,
        role: user.opsRole.code,
        isPlatformSuperAdmin,
      },
      token,
    });

    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });

    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
