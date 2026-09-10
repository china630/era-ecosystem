import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { verifyPassword } from "@/lib/auth/password";
import { signToken } from "@/lib/auth/jwt";
import { getUserByLogin, userPermissions } from "@/lib/services/user.service";
import { prisma } from "@/lib/prisma";
import { enterSatelliteTenant, satelliteRuntimeConfig } from "@era/satellite-kit";
import { ensureSystemHotelRoles } from "@/lib/auth/ensure-system-hotel-roles";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  /** SHARED pool: required. Appliance: omit → process bind only. */
  organizationId: z.string().uuid().optional(),
});

const COOKIE_NAME = process.env.AUTH_COOKIE_NAME ?? "era_session";

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if (
      satelliteRuntimeConfig().deploymentTopology === "SHARED" &&
      !body.organizationId?.trim()
    ) {
      return Response.json(
        { error: "organizationId is required on SHARED pool" },
        { status: 400 },
      );
    }
    const user = await getUserByLogin(body.login, body.organizationId);
    if (!user || user.status !== "ACTIVE") {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const valid = await verifyPassword(body.password, user.passwordHash);
    if (!valid) {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const organizationId = user.organizationId;
    enterSatelliteTenant({ organizationId });

    await ensureSystemHotelRoles(prisma, organizationId);

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Reload role after ensure (permissions may have been filled).
    const refreshed = await prisma.user.findUnique({
      where: { id: user.id },
      include: { role: true },
    });
    if (!refreshed || refreshed.status !== "ACTIVE") {
      return Response.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const permissions = userPermissions(refreshed);
    const token = await signToken({
      sub: refreshed.id,
      login: refreshed.login,
      role: refreshed.role.code,
      fullName: refreshed.fullName,
      email: refreshed.email ?? undefined,
      organizationId,
      permissions,
    });

    const res = jsonOk({
      user: {
        id: refreshed.id,
        login: refreshed.login,
        fullName: refreshed.fullName,
        role: refreshed.role.code,
        organizationId,
        permissions,
      },
      token,
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12,
    });

    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
