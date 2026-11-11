import { userPermissions } from '@/lib/services/user.service';
import { isPlatformSuperAdminUser } from '@/lib/auth/platform-super-admin';
import { canRunHotelImport } from '@/lib/import/auth';
import { fetchControlPlaneOrganizationName } from '@era/satellite-kit';
import { ALL_PERMISSIONS } from '@/lib/auth/permissions';
import { hasHotelPermissionBypass } from '@/lib/auth/permission-check';
import { ensureHotelRolesForOrganization, loadHotelProfileSummary, loadUserWithRole } from '@/lib/services/hotel-auth.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/auth/me", async (httpReq, httpRes) => {
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

  
    if (!session) return sendJson(httpRes, { error: 'Unauthorized' }, 401);

    const organizationId = session.organizationId;
    // Wave 2: remap leftover legacy keys for active sessions (idempotent at v2).
    await ensureHotelRolesForOrganization(organizationId);

    const user = await loadUserWithRole(session.sub);
    if (!user) return sendJson(httpRes, { error: 'Unauthorized' }, 401);

    const profile = await loadHotelProfileSummary();

    // Company name is owned by the orchestrator (control plane). Prefer it and
    // fall back to the local hotel profile name if the control plane is unreachable.
    const controlPlaneName = profile?.organizationId
      ? await fetchControlPlaneOrganizationName(profile.organizationId)
      : null;

    const bypass = hasHotelPermissionBypass({
      login: user.login,
      email: user.email ?? undefined,
      role: user.role.code,
      isOwner: session.isOwner,
    });
    const permissions = bypass
      ? [...ALL_PERMISSIONS]
      : userPermissions(user);

    const canRunElektrawebImport = await canRunHotelImport({
      organizationId,
      email: user.email,
      login: user.login,
      roleCode: user.role.code,
      permissions,
      isOwner: session.isOwner === true || user.role.code === 'BUSINESS_OWNER',
    });

    return sendJson(httpRes, {
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: user.role.code,
      department: user.department,
      permissions,
      organizationName: controlPlaneName ?? profile?.name ?? null,
      organizationId: profile?.organizationId ?? null,
      isPlatformSuperAdmin: isPlatformSuperAdminUser(user),
      isOwner: session.isOwner === true || user.role.code === 'BUSINESS_OWNER',
      canRunElektrawebImport,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
