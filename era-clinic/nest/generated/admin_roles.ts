import { z } from "zod";
import { publishSatelliteRole, publishSatelliteRoleSnapshot } from "@era/satellite-kit";
import { requireClinicPermission } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { CLINIC_PERMISSION, effectiveRolePermissions, rolePermissionsAreCustomized, serializeRolePermissions } from "@/lib/auth/clinic-permissions";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { CLINIC_CUSTOM_ROLE_CODE_RE, isValidCustomClinicRoleCode, normalizeClinicRoleCode } from "@/lib/auth/clinic-role-admin";
import { parseClinicRoleStaffKind } from "@/lib/clinic-roles";
import { createOrgRole, findOrgRoleByCode, listOrgRolesWithUserCounts } from "@/domain/auth/clinic-rbac.service";
import { prisma } from "@/lib/prisma";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  code: z.string().regex(CLINIC_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(32),
  staffKind: z.enum(["DOCTOR", "NURSE", "LAB", "BATH", "MASSAGE", "NONE"]).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/roles", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const organizationId = gate.session.organizationId;
    await ensureSystemClinicRoles(prisma, organizationId);

    const roles = await listOrgRolesWithUserCounts(organizationId);

    void publishSatelliteRoleSnapshot({
      organizationId,
      satelliteKey: "industry_clinic",
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
        );
        return {
          id: role.id,
          code: role.code,
          name: role.name,
          isSystem: role.isSystem,
          staffKind: parseClinicRoleStaffKind(role.staffKind),
          cloneFromCode: role.cloneFromCode,
          userCount: role._count.users,
          permissionCount: permissions.length,
          permissions,
          customized: rolePermissionsAreCustomized(
            role.code,
            role.permissionsJson,
          ),
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
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const gate = await assertClinicAdminRoute(req);
    if (gate.error) return gate.error;

    const denied = await requireClinicPermission(
      gate.session,
      CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE,
    );
    if (denied) return denied;

    const organizationId = gate.session.organizationId;
    await ensureSystemClinicRoles(prisma, organizationId);

    const body = createSchema.parse(httpReq.body);
    const code = normalizeClinicRoleCode(body.code);
    if (!isValidCustomClinicRoleCode(code)) {
      return sendJson(httpRes, { error: "Cannot create a role with a reserved system code" }, 400);
    }

    const existing = await findOrgRoleByCode(organizationId, code);
    if (existing) {
      return sendJson(httpRes, { error: "Role code already exists" }, 409);
    }

    const donor = await findOrgRoleByCode(organizationId, body.cloneFrom);
    if (!donor) {
      return sendJson(httpRes, { error: "cloneFrom role not found" }, 404);
    }

    const permissions = effectiveRolePermissions(
      donor.code,
      donor.permissionsJson,
    );
    const created = await createOrgRole({
      organizationId,
      code,
      name: body.name,
      staffKind: body.staffKind ?? parseClinicRoleStaffKind(donor.staffKind),
      cloneFromCode: donor.code,
      permissionsJson: serializeRolePermissions(permissions),
    });

    await recordClinicAudit(
      { userId: gate.session.sub, request: req },
      "Role",
      created.id,
      "ROLE_CREATE",
      {
        code: created.code,
        name: created.name,
        cloneFrom: donor.code,
        permissionCount: permissions.length,
      },
    );

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_clinic",
      code: created.code,
      name: created.name,
      active: true,
    });

    return sendJson(httpRes, {
      id: created.id,
      code: created.code,
      name: created.name,
      isSystem: false,
      staffKind: parseClinicRoleStaffKind(created.staffKind),
      cloneFromCode: created.cloneFromCode,
      permissions,
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
