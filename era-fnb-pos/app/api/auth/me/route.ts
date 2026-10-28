import {
  fetchSubscriptionSnapshot,
  resolveEntitlementActiveModules,
} from "@era/satellite-kit";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api-utils";
import { getSatelliteSession } from "@/lib/session";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile, upsertFnbOrgSnapshot } from "@/lib/fnb-org-profile";
import { fnbKitchenOn } from "@/lib/fnb-edition";
import {
  ALL_PERMISSIONS,
  effectiveRolePermissions,
  isSystemFnbRoleCode,
} from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { prisma } from "@/lib/prisma";
import { permissionsForRoleCode } from "@/lib/auth/fnb-permission.service";

function sameModuleSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((k) => set.has(k));
}

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session?.organizationId) return jsonError("Unauthorized", 401);

    const organizationId = session.organizationId;

    let permissions = session.permissions ?? [];
    let fullName = session.fullName;
    let login = session.login;
    let email = session.email ?? null;
    let role = session.role;
    let edition: string | null = null;
    let enabledPresets: string[] = [];
    let activeModules: string[] = [];
    let hotelMode: boolean | null = null;

    // A failed role reload must still return the signed-in person.
    // The shell hides the menu and the profile label when this route errors.
    try {
      const profile = await getFnbOrgProfile(organizationId);
      edition = resolveFnbEdition(profile.edition);
      enabledPresets = profile.enabledPresets;
      hotelMode = profile.hotelMode;
      let modules = profile.activeModules;
      try {
        const snap = await fetchSubscriptionSnapshot(organizationId);
        if (snap && Array.isArray(snap.activeModules)) {
          const fromCp = resolveEntitlementActiveModules(snap) ?? [];
          modules = fromCp;
          if (!sameModuleSet(fromCp, profile.activeModules)) {
            void upsertFnbOrgSnapshot(organizationId, {
              activeModules: fromCp,
            }).catch(() => undefined);
          }
        }
      } catch {
        /* keep local profile modules */
      }
      activeModules = fnbKitchenOn({ ...profile, activeModules: modules })
        ? [...new Set([...modules, "fnb_kitchen_kds"])]
        : modules;
      if (session.pin === true) {
        if (isSystemFnbRoleCode(session.role)) {
          const fresh = await permissionsForRoleCode(organizationId, session.role);
          if (fresh.length > 0 || permissions.length === 0) permissions = fresh;
        }
      } else {
        const user = await prisma.user.findFirst({
          where: { id: session.sub },
          include: { role: true },
        });
        if (user) {
          fullName = user.fullName;
          login = user.login;
          email = user.email;
          role = user.role.code;
          const bypass = hasFnbPermissionBypass({
            login: user.login,
            email: user.email ?? undefined,
            role: user.role.code,
            isOwner: session.isOwner === true || user.role.code === "BUSINESS_OWNER",
            pin: false,
          });
          const fresh = bypass
            ? [...ALL_PERMISSIONS]
            : effectiveRolePermissions(
                user.role.code,
                user.role.permissionsJson,
                resolveFnbEdition(profile.edition),
              );
          if (fresh.length > 0 || permissions.length === 0) permissions = fresh;
        }
      }
    } catch {
      /* JWT name and grants stay */
    }

    return jsonOk({
      id: session.sub,
      login,
      fullName,
      email,
      role,
      organizationId,
      organizationName: null,
      permissions,
      pin: session.pin === true,
      outletId: session.outletId ?? null,
      isOwner: session.isOwner === true || role === "BUSINESS_OWNER",
      edition,
      enabledPresets,
      activeModules,
      hotelMode,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}
