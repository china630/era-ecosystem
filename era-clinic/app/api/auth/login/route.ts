import {
  authCookieName,
  enterSatelliteTenant,
  findUserByCredential,
  isSatelliteUserLoginAllowed,
  satelliteRuntimeConfig,
  signSatelliteSession,
  verifySatelliteUserPassword,
} from "@era/satellite-kit";
import { z } from "zod";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getEnabledPresets } from "@/domain/settings/settings.service";
import {
  PRESETS_COOKIE,
  serializePresetsCookie,
} from "@/domain/presets/preset-cookie";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  /** SHARED pool: required. Appliance: omit → process bind only. */
  organizationId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    if (
      satelliteRuntimeConfig().deploymentTopology === "SHARED" &&
      !body.organizationId?.trim()
    ) {
      return jsonError("organizationId is required on SHARED pool", 400);
    }
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
    const enabledPresets = await getEnabledPresets();
    const res = jsonOk({
      user: {
        id: user.id,
        login: user.login,
        fullName: user.fullName,
        role: user.role.code,
        organizationId,
      },
      token,
      enabledPresets,
    });
    res.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 4,
    });
    res.cookies.set(PRESETS_COOKIE, serializePresetsCookie(enabledPresets), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
