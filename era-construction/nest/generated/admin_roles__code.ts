import { z } from "zod";
import { publishSatelliteRole } from "@era/satellite-kit";
import { NextResponse } from "next/server";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { canDeleteRole, canMutateCustomRoleMeta } from "@/lib/auth/construction-role-admin";
import { recordAudit } from "@/lib/satellite-audit";
import { deleteRoleById, findOrgRoleByCode, findOrgRoleByCodeWithUserCount, updateRoleName } from "@/lib/admin-roles.service";
import { enterConstructionStaff, constructionNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithConstructionTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

type RouteParams = { params: Promise<{ code: string }> };

const patchSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.patch("/api/admin/roles/:code", async (httpReq, httpRes) => {
    if (!(await enterConstructionStaff(httpReq, httpRes))) return;
    try {
      const session = await constructionNestSession(httpReq);
      const web = await runWithConstructionTenant(session, async () => {
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

    const role = await findOrgRoleByCode(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);
    if (!canMutateCustomRoleMeta(role)) {
      return sendJson(httpRes, { error: "Cannot rename a system role" }, 400);
    }

    const updated = await updateRoleName(role.id, body.name);
    await recordAudit({ userId: session.sub, request: req }, "Role", role.id, "ROLE_UPDATE", {
      code: role.code,
      before: { name: role.name },
      after: { name: updated.name },
    });

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_construction",
      code: updated.code,
      name: updated.name,
      active: true,
    });

    return sendJson(httpRes, {
      code: updated.code,
      name: updated.name,
      isSystem: updated.isSystem,
      cloneFromCode: updated.cloneFromCode,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.delete("/api/admin/roles/:code", async (httpReq, httpRes) => {
    if (!(await enterConstructionStaff(httpReq, httpRes))) return;
    try {
      const session = await constructionNestSession(httpReq);
      const web = await runWithConstructionTenant(session, async () => {
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

    const role = await findOrgRoleByCodeWithUserCount(organizationId, code);
    if (!role) return sendJson(httpRes, { error: "Role not found" }, 404);
    const deletable = canDeleteRole({
      isSystem: role.isSystem,
      code: role.code,
      userCount: role._count.users,
    });
    if (!deletable.ok) {
      if (deletable.reason === "system") {
        return sendJson(httpRes, { error: "Cannot delete a system role" }, 400);
      }
      return sendJson(httpRes, 
        { error: "Role still has users", userCount: role._count.users }, 409);
    }

    await deleteRoleById(role.id);
    await recordAudit({ userId: session.sub, request: req }, "Role", role.id, "ROLE_DELETE", {
      code: role.code,
      name: role.name,
    });

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_construction",
      code: role.code,
      name: role.name,
      active: false,
    });

    return sendJson(httpRes, { deleted: true, code: role.code });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
