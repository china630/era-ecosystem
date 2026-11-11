import { z } from "zod";
import { publishSatelliteRole, publishSatelliteRoleSnapshot } from "@era/satellite-kit";
import { assertPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { effectiveRolePermissions } from "@/lib/auth/permission-catalog";
import { ensureSystemRoles } from "@/lib/auth/ensure-system-crm-roles";
import { CUSTOM_ROLE_CODE_RE, isValidCustomRoleCode, normalizeRoleCode } from "@/lib/auth/crm-role-admin";
import { prisma } from "@/lib/prisma";
import { createOrgRoleFromDonor, findOrgRoleByCode, listOrgRolesWithCounts, mapRoleListPayload } from "@/lib/admin-roles.service";
import { recordAudit } from "@/lib/satellite-audit";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  code: z.string().trim().toUpperCase().regex(CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/roles", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
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
    const organizationId = session.organizationId;
    await ensureSystemRoles(prisma, organizationId);

    const roles = await listOrgRolesWithCounts(organizationId);

    void publishSatelliteRoleSnapshot({
      organizationId,
      satelliteKey: "industry_crm",
      roles: roles.map((role) => ({
        code: role.code,
        name: role.name,
        active: true,
      })),
    });

    return sendJson(httpRes, mapRoleListPayload(roles));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/roles", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      const web = await runWithCrmTenant(session, async () => {
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
    await ensureSystemRoles(prisma, organizationId);

    const body = createSchema.parse(httpReq.body);
    const code = normalizeRoleCode(body.code);
    if (!isValidCustomRoleCode(code)) {
      return sendJson(httpRes, { error: "Cannot create a role with a reserved system code" }, 400);
    }
    const existing = await findOrgRoleByCode(organizationId, code);
    if (existing) return sendJson(httpRes, { error: "Role code already exists" }, 409);

    const donor = await findOrgRoleByCode(
      organizationId,
      normalizeRoleCode(body.cloneFrom),
    );
    if (!donor) return sendJson(httpRes, { error: "cloneFrom role not found" }, 404);

    const permissions = effectiveRolePermissions(donor);
    const created = await createOrgRoleFromDonor({
      organizationId,
      code,
      name: body.name,
      donorCode: donor.code,
      permissions,
    });

    await recordAudit({ userId: session.sub, request: req }, "Role", created.id, "ROLE_CREATE", {
      code: created.code,
      cloneFrom: donor.code,
    });

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_crm",
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
        userCount: 0,
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
