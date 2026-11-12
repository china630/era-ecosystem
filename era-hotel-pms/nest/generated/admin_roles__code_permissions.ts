import { z } from "zod";
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, ROLE_PERMISSIONS, effectiveRolePermissions, isHotelPermission, parsePermissions, serializePermissions, type Permission, type RoleCode } from "@/lib/auth/permissions";
import { isSystemHotelRoleCode } from "@/lib/hotel-roles";
import { findHotelRoleByCode, updateHotelRolePermissions } from "@/lib/services/hotel-role.service";
import { recordHotelAudit } from "@/lib/satellite-audit";
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  permissions: z.array(z.string()).optional(),
  resetToDefaults: z.boolean().optional(),
});

type RouteParams = { params: Promise<{ code: string }> };

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/roles/:code/permissions", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    const role = await findHotelRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    const permissions = effectiveRolePermissions(role.code, role.permissionsJson);
    return sendJson(httpRes, {
      code: role.code,
      name: role.name,
      isSystem: role.isSystem,
      cloneFromCode: role.cloneFromCode,
      permissions,
      customized: parsePermissions(role.permissionsJson).length > 0,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/roles/:code/permissions", async (httpReq, httpRes) => {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const { code } = httpReq.params;
    const organizationId = session.organizationId;
    const body = patchSchema.parse(httpReq.body);
    const role = await findHotelRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);

    let next: Permission[];
    if (body.resetToDefaults) {
      if (isSystemHotelRoleCode(code) && ROLE_PERMISSIONS[code as RoleCode]) {
        next = [...ROLE_PERMISSIONS[code as RoleCode]];
      } else if (role.cloneFromCode) {
        const donor = await findHotelRoleByCode(organizationId, role.cloneFromCode);
        if (!donor) {
          return sendJson(httpRes, { error: "cloneFrom role missing; cannot reset" }, 400);
        }
        next = effectiveRolePermissions(donor.code, donor.permissionsJson);
      } else {
        return sendJson(httpRes, { error: "No defaults available for this role" }, 400);
      }
    } else if (body.permissions) {
      const invalid = body.permissions.filter((p) => !isHotelPermission(p));
      if (invalid.length > 0) {
        return sendJson(httpRes, 
          { error: "Unknown permission codes", invalid }, 400);
      }
      next = body.permissions as Permission[];
    } else {
      return sendJson(httpRes, { error: "permissions or resetToDefaults required" }, 400);
    }

    const before = parsePermissions(role.permissionsJson);
    const updated = await updateHotelRolePermissions(
      role.id,
      serializePermissions(next),
    );

    await recordHotelAudit(
      { userId: session!.sub, request: req },
      "Role",
      role.id,
      "PERMISSIONS_UPDATE",
      {
        roleCode: code,
        before,
        after: next,
        resetToDefaults: body.resetToDefaults === true,
      },
    );

    return sendJson(httpRes, {
      code: updated.code,
      permissions: next,
      customized: true,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
