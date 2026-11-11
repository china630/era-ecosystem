import { NextResponse } from "next/server";
import { z } from "zod";
import { ERA_I18N_COOKIE, eraLocaleCookieOptions, isLocale } from "@era/i18n-common";
import { enterCrmStaff, crmNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithCrmTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({ locale: z.string() });

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/locale", async (httpReq, httpRes) => {
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

  const body = schema.parse(httpReq.body);
  if (!isLocale(body.locale)) {
    return sendJson(httpRes, { error: "Unsupported locale" }, 400);
  }
  const res = NextResponse.json({ ok: true, locale: body.locale });
  const opts = eraLocaleCookieOptions();
  res.cookies.set(ERA_I18N_COOKIE, body.locale, opts);
  res.cookies.set("NEXT_LOCALE", body.locale, opts);
  return sendWebResponse(httpRes, res);

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
