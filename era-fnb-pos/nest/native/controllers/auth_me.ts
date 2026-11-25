/** Lifted from nest/generated/auth_me.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { fetchSubscriptionSnapshot, resolveEntitlementActiveModules } from "@era/satellite-kit";
import { resolveFnbEdition } from "@/lib/auth/ensure-system-fnb-roles";
import { getFnbOrgProfile, upsertFnbOrgSnapshot } from "@/lib/fnb-org-profile";
import { fnbKitchenOn } from "@/lib/fnb-edition";
import { ALL_PERMISSIONS, effectiveRolePermissions, isSystemFnbRoleCode } from "@/lib/auth/permissions";
import { hasFnbPermissionBypass } from "@/lib/auth/permission-check";
import { findActiveOutletForMe, findUserWithRoleBySub } from "@/lib/fnb-auth.service";
import { permissionsForRoleCode } from "@/lib/auth/fnb-permission.service";
import { getEffectiveBuffetCostForOutlet } from "@/lib/buffet-cost-settings.service";
import { getSelectedOutletId } from "@/lib/outlet-session";
import { capabilitiesFromOutletRow } from "@/lib/outlet-capabilities";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

function sameModuleSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const set = new Set(a);
  return b.every((k) => set.has(k));
}


@Controller()
export class AuthMeController {
  @Get("api/auth/me")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
              

  
    if (!session?.organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);

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
    let buffetCost: Awaited<ReturnType<typeof getEffectiveBuffetCostForOutlet>> | null =
      null;

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
        const user = await findUserWithRoleBySub(session.sub);
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
      try {
        buffetCost = await getEffectiveBuffetCostForOutlet(
          session.outletId ?? null,
          organizationId,
        );
      } catch {
        buffetCost = null;
      }
    } catch {
      /* JWT name and grants stay */
    }

    const cookieOutletId = await getSelectedOutletId();
    const outletId = cookieOutletId || session.outletId || null;
    let selectedOutlet: {
      id: string;
      code: string;
      name: string;
      capabilities: ReturnType<typeof capabilitiesFromOutletRow>;
    } | null = null;
    if (outletId) {
      const row = await findActiveOutletForMe(outletId, organizationId);
      if (row) {
        selectedOutlet = {
          id: row.id,
          code: row.code,
          name: row.name,
          capabilities: capabilitiesFromOutletRow(row),
        };
      }
    }

    return sendJson(httpRes, {
      id: session.sub,
      login,
      fullName,
      email,
      role,
      organizationId,
      organizationName: null,
      permissions,
      pin: session.pin === true,
      outletId: selectedOutlet?.id ?? outletId,
      selectedOutlet,
      isOwner: session.isOwner === true || role === "BUSINESS_OWNER",
      edition,
      enabledPresets,
      activeModules,
      hotelMode,
      buffetCost,
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
