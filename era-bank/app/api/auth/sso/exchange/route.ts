import {
  authCookieName,
  consumeSsoSignatureOnce,
  mapFinanceRoleToSatellite,
  resolveVerifiedSsoFinanceRole,
  SATELLITE_ROLE,
  signSatelliteSession,
  ssoExchangeBodySchema,
  setRuntimeOrganizationId,
  satelliteOrganizationId,
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

    const expectedOrg = satelliteOrganizationId();
    if (
      expectedOrg &&
      expectedOrg !== "demo-org" &&
      body.organizationId !== expectedOrg
    ) {
      return jsonError("Organization mismatch", 403);
    }

    const financeRole = resolveVerifiedSsoFinanceRole({
      email: body.email,
      organizationId: body.organizationId,
      expiresAt: body.expiresAt,
      signature: body.signature,
      financeRole: body.financeRole,
      jti: body.jti,
    });
    if (!financeRole) {
      return jsonError("Invalid SSO signature", 401);
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      return jsonError("SSO ticket already used", 401);
    }

    setRuntimeOrganizationId(body.organizationId);

    const satelliteRole = mapFinanceRoleToSatellite(financeRole);
    const roleName =
      satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER
        ? "Business Owner"
        : "Executive viewer";

    const role = await prisma.opsRole.upsert({
      where: { code: satelliteRole },
      update: { name: roleName },
      create: {
        code: satelliteRole,
        name: roleName,
        limitsJson: { readOnly: satelliteRole !== SATELLITE_ROLE.BUSINESS_OWNER },
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
      role: user.opsRole.code,
      fullName: user.fullName,
      isOwner: satelliteRole === SATELLITE_ROLE.BUSINESS_OWNER,
      organizationId: body.organizationId,
    });

    const res = jsonOk({
      user: {
        id: user.id,
        login: user.username,
        fullName: user.fullName,
        role: user.opsRole.code,
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
