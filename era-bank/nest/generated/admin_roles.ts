import { z } from "zod";
import { publishSatelliteRole, publishSatelliteRoleSnapshot } from "@era/satellite-kit";
import { assertAnyPermission, assertPermission } from "@/lib/auth/require";
import { PERMISSIONS, effectiveRolePermissions, parsePermissions, serializePermissions } from "@/lib/auth/permissions";
import { ensureSystemBankRoles, BANK_PERMISSION_CATALOG_VERSION } from "@/lib/auth/ensure-system-bank-roles";
import { BANK_CUSTOM_ROLE_CODE_RE, isValidCustomBankRoleCode, normalizeBankRoleCode } from "@/lib/auth/bank-role-admin";
import { prisma } from "@/lib/prisma";
import { createOpsRole, findOpsRoleByCode, listOpsRoles } from "@/lib/bank-ops.service";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  code: z.string().regex(BANK_CUSTOM_ROLE_CODE_RE, "Invalid role code"),
  name: z.string().trim().min(1).max(120),
  cloneFrom: z.string().trim().min(1).max(64),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/roles", async (httpReq, httpRes) => {
    if (!(await enterBankStaff(httpReq, httpRes))) return;
    try {
      const session = await bankNestSession(httpReq);
      const web = await runWithBankTenant(session, async () => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertAnyPermission(session, [PERMISSIONS.ACCESS_MANAGE]);

    const organizationId = session.organizationId;
    if (!organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    await ensureSystemBankRoles(prisma, organizationId);

    const roles = await listOpsRoles(organizationId);

    void publishSatelliteRoleSnapshot({
      organizationId,
      satelliteKey: "industry_banking",
      roles: roles.map((role) => ({
        code: role.code,
        name: role.name,
        active: true,
      })),
    });

    return sendJson(httpRes, 
      roles.map((role) => {
        const perms = effectiveRolePermissions(
          role.code,
          role.permissionsJson,
        );
        return {
          id: role.id,
          code: role.code,
          name: role.name,
          isSystem: role.isSystem,
          cloneFromCode: role.cloneFromCode,
          userCount: role._count.users,
          permissionCount: perms.length,
          permissions: perms,
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
    if (!(await enterBankStaff(httpReq, httpRes))) return;
    try {
      const session = await bankNestSession(httpReq);
      const web = await runWithBankTenant(session, async () => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    assertPermission(session, PERMISSIONS.ACCESS_MANAGE);

    const organizationId = session.organizationId;
    if (!organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    await ensureSystemBankRoles(prisma, organizationId);

    const body = createSchema.parse(httpReq.body);
    const code = normalizeBankRoleCode(body.code);
    if (!isValidCustomBankRoleCode(code)) {
      return sendJson(httpRes, { error: "Cannot create a role with a reserved system code" }, 400);
    }

    const existing = await findOpsRoleByCode(organizationId, code);
    if (existing) {
      return sendJson(httpRes, { error: "Role code already exists" }, 409);
    }

    const donor = await findOpsRoleByCode(organizationId, body.cloneFrom);
    if (!donor) {
      return sendJson(httpRes, { error: "cloneFrom role not found" }, 404);
    }

    const donorPerms = effectiveRolePermissions(
      donor.code,
      donor.permissionsJson,
    );
    const created = await createOpsRole({
      organizationId,
      code,
      name: body.name,
      isSystem: false,
      cloneFromCode: donor.code,
      permissionsJson: serializePermissions(donorPerms),
      permissionCatalogVersion: BANK_PERMISSION_CATALOG_VERSION,
      limitsJson: {},
    });

    void publishSatelliteRole({
      organizationId,
      satelliteKey: "industry_banking",
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
        permissions: donorPerms,
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
