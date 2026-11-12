import { z } from "zod";
import { publishSatelliteRole, publishSatelliteRoleSnapshot } from "@era/satellite-kit";
import { assertAnyPermission, assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, effectiveRolePermissions, parsePermissions, serializePermissions } from "@/lib/auth/permissions";
import { FNB_CUSTOM_ROLE_CODE_RE, isValidCustomFnbRoleCode, normalizeFnbRoleCode } from "@/lib/auth/fnb-role-admin";
import { createOrganizationRole, ensureFnbRolesForOrg, findOrganizationRoleByCode, listOrganizationRoles } from "@/lib/fnb-roles";
import { recordFbAudit } from "@/lib/satellite-audit";
import { editionForOrg } from "@/lib/auth/fnb-permission.service";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  code: z.string().regex(FNB_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/roles", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    assertAnyPermission(session, [PERMISSIONS.ACCESS_MANAGE]);

    const organizationId = session.organizationId;
    const edition = await editionForOrg(organizationId);
    await ensureFnbRolesForOrg(organizationId, edition);

    const roles = await listOrganizationRoles(organizationId);

    void publishSatelliteRoleSnapshot({
      organizationId,
      satelliteKey: "industry_fnb_pos",
      roles: roles.map((role) => ({
        code: role.code,
        name: role.name,
        active: true,
      })),
    });

    return sendJson(httpRes, 
      roles.map((role) => {
        const permissions = effectiveRolePermissions(
          role.code,
          role.permissionsJson,
          edition,
        );
        return {
          id: role.id,
          code: role.code,
          name: role.name,
          isSystem: role.isSystem,
          cloneFromCode: role.cloneFromCode,
          userCount: role._count.users,
          permissionCount: permissions.length,
          permissions,
          customized: parsePermissions(role.permissionsJson).length > 0,
        };
      }),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/roles", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

    const organizationId = session.organizationId;
    const edition = await editionForOrg(organizationId);
    await ensureFnbRolesForOrg(organizationId, edition);

    const body = createSchema.parse(httpReq.body);
    const code = normalizeFnbRoleCode(body.code);
    if (!isValidCustomFnbRoleCode(code)) {
      return sendJson(httpRes, { error: "Cannot create a role with a reserved system code" }, 400);
    }

    const existing = await findOrganizationRoleByCode(organizationId, code);
    if (existing) {
      return sendJson(httpRes, { error: "Role code already exists" }, 409);
    }

    const donor = await findOrganizationRoleByCode(organizationId, body.cloneFrom);
    if (!donor) {
      return sendJson(httpRes, { error: "cloneFrom role not found" }, 404);
    }

    const permissions = effectiveRolePermissions(
      donor.code,
      donor.permissionsJson,
      edition,
    );
    const created = await createOrganizationRole({
      organizationId,
      code,
      name: body.name,
      cloneFromCode: donor.code,
      permissionsJson: serializePermissions(permissions),
    });

    await recordFbAudit(
      { userId: session!.sub, request: req },
      "Role",
      created.id,
      "ROLE_CREATE",
      { code: created.code, cloneFrom: donor.code },
    );

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_fnb_pos",
      code: created.code,
      name: created.name,
      active: true,
    });

    return sendJson(httpRes, 
      {
        id: created.id,
        code: created.code,
        name: created.name,
        isSystem: false,
        cloneFromCode: created.cloneFromCode,
        permissions,
      },
      201,
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
