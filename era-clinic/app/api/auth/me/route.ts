import { jsonError, jsonOk, handleRouteError, getRouteSession } from "@/lib/api-utils";

import { hasClinicAdminAccess } from "@/lib/auth/clinic-admin-access";

import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";

import { getEnabledPresets } from "@/domain/settings/settings.service";

import {

  PRESETS_COOKIE,

  serializePresetsCookie,

} from "@/domain/presets/preset-cookie";

import { prisma } from "@/lib/prisma";

import { fetchControlPlaneOrganizationName, resolveSatelliteOrganizationId } from "@era/satellite-kit";



export async function GET() {

  try {

    const session = await getRouteSession();

    if (!session) return jsonError("Unauthorized", 401);



    const user = await prisma.user.findUnique({

      where: { id: session.sub },

      include: { role: true },

    });

    if (!user || user.status !== "ACTIVE") {

      return jsonError("Unauthorized", 401);

    }



    const tenant = await prisma.tenant.findFirst({
      where: { code: "default" },
      select: { name: true, checkInRequiresQr: true, procedureCheckInMode: true },
    });



    // Company name is owned by the orchestrator (control plane); fall back to
    // the local tenant name if the control plane is unreachable.

    const bound = resolveSatelliteOrganizationId({ allowFallback: true });

    const controlPlaneName =
      bound.source !== "fallback"
        ? await fetchControlPlaneOrganizationName(bound.organizationId)
        : null;



    const enabledPresets = await getEnabledPresets();



    const mergedSession = {

      ...session,

      email: session.email ?? user.email ?? undefined,

      login: session.login || user.login,

    };



    const res = jsonOk({

      id: user.id,

      login: user.login,

      email: user.email,

      fullName: user.fullName,

      role: user.role.code,

      organizationName: controlPlaneName ?? tenant?.name ?? null,

      canViewClinicAdmin: hasClinicAdminAccess(mergedSession),

      isPlatformSuperAdmin: isPlatformSuperAdminUser(user),
      enabledPresets,
      checkInMode:
        tenant?.procedureCheckInMode ??
        (tenant?.checkInRequiresQr === false ? "MANUAL" : "QR"),
      checkInRequiresQr:
        (tenant?.procedureCheckInMode ?? (tenant?.checkInRequiresQr === false ? "MANUAL" : "QR")) === "QR",
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

