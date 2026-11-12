import { sessionIsPlatformSuperAdmin } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";
import { findOpsRoleById, findOpsUserWithRole } from "@/lib/bank-ops.service";
import { bankActiveModules } from "@/lib/bank-entitlement-modules";
import { ensureSystemBankRoles } from "@/lib/auth/ensure-system-bank-roles";
import { ALL_PERMISSIONS, effectiveRolePermissions, sanitizeLimitsJson, PERMISSIONS } from "@/lib/auth/permissions";
import { hasBankPermissionBypass, sessionHasBankPermission } from "@/lib/auth/permission-check";
import { enterBankStaff, bankNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithBankTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/auth/me", async (httpReq, httpRes) => {
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

    const user = await findOpsUserWithRole(session.sub);
    if (!user) return sendJson(httpRes, { error: "User not found" }, 404);

    await ensureSystemBankRoles(prisma, user.organizationId);

    const role = await findOpsRoleById(user.opsRoleId);

    const limits = sanitizeLimitsJson(
      (role.limitsJson ?? {}) as Record<string, unknown>,
    );
    const isPlatformSuperAdmin = sessionIsPlatformSuperAdmin(session);
    const isOwner =
      session.isOwner === true || role.code === "BUSINESS_OWNER";
    const bypass = hasBankPermissionBypass({
      login: user.username,
      email: session.email,
      role: role.code,
      isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : effectiveRolePermissions(role.code, role.permissionsJson);

    const canApprove =
      isPlatformSuperAdmin ||
      sessionHasBankPermission(
        {
          login: user.username,
          email: session.email,
          role: role.code,
          permissions,
          isOwner,
        },
        PERMISSIONS.POSTINGS_APPROVE,
      ) ||
      sessionHasBankPermission(
        {
          login: user.username,
          email: session.email,
          role: role.code,
          permissions,
          isOwner,
        },
        PERMISSIONS.PAYMENTS_APPROVE,
      ) ||
      sessionHasBankPermission(
        {
          login: user.username,
          email: session.email,
          role: role.code,
          permissions,
          isOwner,
        },
        PERMISSIONS.LOANS_APPROVE,
      ) ||
      sessionHasBankPermission(
        {
          login: user.username,
          email: session.email,
          role: role.code,
          permissions,
          isOwner,
        },
        PERMISSIONS.DEPOSITS_APPROVE,
      ) ||
      sessionHasBankPermission(
        {
          login: user.username,
          email: session.email,
          role: role.code,
          permissions,
          isOwner,
        },
        PERMISSIONS.RISK_APPROVE,
      );

    let activeModules: string[] = [];
    try {
      activeModules = await bankActiveModules();
    } catch {
      activeModules = [];
    }

    return sendJson(httpRes, {
      id: user.id,
      login: user.username,
      fullName: user.fullName,
      email: session.email ?? null,
      role: role.code,
      branchId: user.branchId,
      permissions,
      canApprove,
      limitsJson: limits,
      isPlatformSuperAdmin,
      isOwner,
      organizationName: process.env.ERA_BANK_ORGANIZATION_NAME ?? "ERA Bank",
      activeModules,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
