import {
  authCookieName,
  authenticateIndustryStaffLogin,
  jsonLoginHostBinding,
  satelliteRuntimeConfig,
  signSatelliteSession,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { permissionsForUser } from "@/lib/auth/clinic-permission.service";
import { getEnabledPresets } from "@/domain/settings/settings.service";
import {
  PRESETS_COOKIE,
  serializePresetsCookie,
} from "@/domain/presets/preset-cookie";
import { prisma } from "@/lib/prisma";
import { recordUserLogin } from "@/domain/auth/user-login.service";

export async function POST(request: Request) {
  try {
    const auth = await authenticateIndustryStaffLogin({
      request,
      prisma,
      isShared: satelliteRuntimeConfig().deploymentTopology === "SHARED",
    });
    if (!auth.ok) {
      return jsonError(auth.error, auth.status);
    }
    const user = auth.user;
    const organizationId = auth.organizationId;

    const { ensureSystemClinicRoles } = await import(
      "@/lib/auth/ensure-system-clinic-roles"
    );
    await ensureSystemClinicRoles(prisma, organizationId);
    const { ensureClinicCatalogIfEmpty } = await import(
      "@/domain/catalog/ensure-clinic-catalog-from-templates"
    );
    await ensureClinicCatalogIfEmpty(prisma, organizationId);

    const permissions = await permissionsForUser(user.id);
    await recordUserLogin(
      { id: user.id, organizationId, login: user.login },
      request,
    );
    const token = await signSatelliteSession({
      sub: user.id,
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      fullName: user.fullName,
      organizationId,
      permissions,
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
      maxAge: 60 * 60 * 12,
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

export async function GET(request: Request) {
  return jsonLoginHostBinding(request);
}
