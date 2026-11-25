import { dboPaths, engineDboFetch, engineDboJson } from "@/lib/engine-dbo-client";
import { requireCustomerSession } from "@/lib/api-utils";
import {
  nestHeader,
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
  http.get("/api/loans", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
          const auth = await requireCustomerSession();
          if (auth instanceof Response) return auth;
          const data = await engineDboFetch(dboPaths.loans, {
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

  http.get("/api/loans/:id", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
          const auth = await requireCustomerSession();
          if (auth instanceof Response) return auth;
          const id = String(httpReq.params?.id ?? "");
          const data = await engineDboFetch(dboPaths.loan(id), {
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

  http.post("/api/loans/:id/prepay", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
          const auth = await requireCustomerSession();
          if (auth instanceof Response) return auth;
          const id = String(httpReq.params?.id ?? "");
          const data = await engineDboJson(
            "POST",
            dboPaths.loanPrepay(id),
            httpReq.body,
            { customerJwt: auth.session.customerJwt ?? undefined },
          );
          return sendJson(httpRes, data);
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
