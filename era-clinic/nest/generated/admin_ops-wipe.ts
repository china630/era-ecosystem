import { z } from "zod";
import { jsonError, handleRouteError, getSatelliteSession } from "@/lib/api-utils";
import { isPlatformSuperAdminUser } from "@/lib/auth/platform-super-admin";
import { recordClinicAudit } from "@/lib/satellite-audit";
import { countClinicOpsWipe, runClinicOpsWipe } from "@/domain/ops/ops-wipe.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const confirmSchema = z.object({
  organizationId: z.string().uuid(),
  confirmPhrase: z.literal("WIPE"),
  ops: z.array(z.string()).optional(),
  catalog: z.array(z.string()).optional(),
});

async function superAdminSession() {
  const session = await getSatelliteSession();
  if (!session) throw Object.assign(new Error("Unauthorized"), { status: 401 });
  if (!isPlatformSuperAdminUser({ email: session.email ?? null, login: session.login })) {
    throw Object.assign(new Error("Forbidden: platform super admin only"), {
      status: 403,
    });
  }
  return session;
}





function routeError(err: unknown) {
  if (
    err &&
    typeof err === "object" &&
    "status" in err &&
    typeof (err as { status?: number }).status === "number"
  ) {
    const status = (err as { status: number }).status;
    const message = err instanceof Error ? err.message : "Error";
    return jsonError(message, status);
  }
  return handleRouteError(err);
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/admin/ops-wipe", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    const session = await superAdminSession();
    return sendJson(httpRes, {
      organizationId: session.organizationId,
      counts: await countClinicOpsWipe(session.organizationId),
    });
  } catch (err) {
    return routeError(err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/admin/ops-wipe", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  try {
    const session = await superAdminSession();
    const body = confirmSchema.parse(httpReq.body);
    if (body.organizationId !== session.organizationId) {
      throw Object.assign(
        new Error("Organization changed since counts were loaded — reload the page"),
        { status: 409 },
      );
    }
    const deleted = await runClinicOpsWipe(session.organizationId, {
      ops: body.ops,
      catalog: body.catalog,
    });
    await recordClinicAudit(
      { userId: session.sub, request },
      "OpsWipe",
      session.organizationId,
      "WIPE",
      { deleted },
    );
    return sendJson(httpRes, {
      organizationId: session.organizationId,
      deleted,
      counts: await countClinicOpsWipe(session.organizationId),
    });
  } catch (err) {
    return routeError(err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
