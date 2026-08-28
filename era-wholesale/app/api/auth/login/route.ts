import {
  authCookieName,
  enterSatelliteTenant,
  findUserByCredential,
  isSatelliteUserLoginAllowed,
  signSatelliteSession,
  verifySatelliteUserPassword,
} from "@era/satellite-kit";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  /** SHARED pool: which org. Appliance: omit → process bind only. */
  organizationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const user = await findUserByCredential(prisma, body.login, body.organizationId);
    if (!user || !isSatelliteUserLoginAllowed(user)) {
      return jsonError("Invalid credentials", 401);
    }
    const valid = await verifySatelliteUserPassword(body.password, user);
    if (!valid) {
      return jsonError("Invalid credentials", 401);
    }

    const organizationId = user.organizationId;
    enterSatelliteTenant({ organizationId });

    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      fullName: user.fullName,
      organizationId,
    });
    const res = jsonOk({
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
        organizationId,
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
