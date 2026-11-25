import { dboPaths, engineDboFetch } from "@/lib/engine-dbo-client";
import { requireCustomerSession } from "@/lib/api-utils";
import {
  runWithNestHttp,
  runWithStaffTenantIfPresent,
  sendJson,
  sendRouteError,
  sendWebResponse,
} from "../bridge";

export function register(http: {
  get: Function;
  post: Function;
  put: Function;
  patch: Function;
  delete: Function;
}) {
  http.get("/api/leasing/contracts/:id/schedule", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
          const auth = await requireCustomerSession();
          if (auth instanceof Response) return auth;
          const id = String(httpReq.params?.id ?? "");
          const data = await engineDboFetch(dboPaths.leasingSchedule(id), {
            customerJwt: auth.session.customerJwt ?? undefined,
          });
          return sendJson(httpRes, data);
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
