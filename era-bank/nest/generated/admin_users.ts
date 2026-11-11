import { z } from "zod";
import { assertAnyPermission } from "@/lib/auth/require";
import { PERMISSIONS, resolveBankRoleCode } from "@/lib/auth/permissions";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import { prisma } from "@/lib/prisma";
import { assignOpsUserRole, findOpsRoleByCode, findOpsUserInOrg, listOpsUsers } from "@/lib/bank-ops.service";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const patchSchema = z.object({
  userId: z.string().min(1),
  roleCode: z.string().trim().min(1).max(64),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/users", async (httpReq, httpRes) => {
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
    assertAnyPermission(
      session,
      [PERMISSIONS.USERS, PERMISSIONS.ACCESS_MANAGE],
    );

    const organizationId = session.organizationId;
    if (!organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    await ensureSystemBankRoles(prisma, organizationId);

    const users = await listOpsUsers(organizationId);

    return sendJson(httpRes, 
      users.map((u) => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        status: u.status,
        branchId: u.branchId,
        roleCode: u.opsRole.code,
        roleName: u.opsRole.name,
      })),
    );
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/admin/users", async (httpReq, httpRes) => {
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
    assertAnyPermission(
      session,
      [PERMISSIONS.USERS, PERMISSIONS.ACCESS_MANAGE],
    );

    const organizationId = session.organizationId;
    if (!organizationId) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    await ensureSystemBankRoles(prisma, organizationId);

    const body = patchSchema.parse(httpReq.body);
    const resolved = resolveBankRoleCode(body.roleCode);
    const code = resolved ?? body.roleCode.trim().toUpperCase();
    const role = await findOpsRoleByCode(organizationId, code);
    if (!role) {
      return sendJson(httpRes, { error: "Unknown role code" }, 400);
    }

    const user = await findOpsUserInOrg(body.userId, organizationId);
    if (!user) return sendJson(httpRes, { error: "User not found" }, 404);

    const updated = await assignOpsUserRole(user.id, role.id);

    return sendJson(httpRes, {
      id: updated.id,
      username: updated.username,
      roleCode: updated.opsRole.code,
      roleName: updated.opsRole.name,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
