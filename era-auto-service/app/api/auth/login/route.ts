import {
  ORG_NO_RE,
  authCookieName,
  enterSatelliteTenant,
  findUserByCredential,
  jsonLoginHostBinding,
  readStaffLoginJson,
  resolveStaffLoginTenant,
  satelliteRuntimeConfig,
  signSatelliteSession,
  verifySatelliteUserPassword,
} from "@era/satellite-kit";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-auto-roles";
import { OWNER_ROLE_CODE } from "@/lib/auth/permission-check";
import { grantsForUser } from "@/lib/auth/auto-permission.service";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  /** Required unless the host already names the organization. */
  orgNo: z.string().regex(ORG_NO_RE).optional(),
});

export async function POST(request: Request) {
  try {
    const rawBody = await readStaffLoginJson(request);
    if (!rawBody.ok) {
      return jsonError(rawBody.error, rawBody.status);
    }
    const body = schema.parse(rawBody.raw);
    const tenant = await resolveStaffLoginTenant({
      orgNo: body.orgNo,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
      request,
    });
    if (!tenant.ok) {
      return jsonError(tenant.error, tenant.status);
    }
    const found = await findUserByCredential(prisma, body.login, tenant.organizationId);
    if (!(await verifySatelliteUserPassword(body.password, found)) || !found) {
      return jsonError("Invalid credentials", 401);
    }

    const organizationId = found.organizationId;
    enterSatelliteTenant({ organizationId });
    await ensureSystemRoles(prisma, organizationId);

    const user = await prisma.user.findUnique({
      where: { id: found.id },
      include: { role: true },
    });
    if (!user) return jsonError("Invalid credentials", 401);
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
    const res = jsonOk({
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

export async function GET(request: Request) {
  return jsonLoginHostBinding(request);
}
