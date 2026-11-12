import { z } from "zod";
import { denyUnlessPermission } from "@/lib/auth/require";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { getFnbOrgProfile, setFnbEnabledPresets } from "@/lib/fnb-org-profile";
import { FNB_PRESETS, FNB_SELECTABLE_PRESETS, allowedFnbPresets } from "@/lib/fnb-edition";
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function selectable(edition: Parameters<typeof allowedFnbPresets>[0]) {
  return allowedFnbPresets(edition).filter((p) => FNB_SELECTABLE_PRESETS.includes(p));
}



const patchSchema = z.object({
  enabledPresets: z.array(z.enum(FNB_PRESETS)).min(1).max(FNB_PRESETS.length),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/settings/presets", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return denied;
    const profile = await getFnbOrgProfile();
    return sendJson(httpRes, {
      edition: profile.edition,
      enabledPresets: profile.enabledPresets,
      selectablePresets: selectable(profile.edition),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.patch("/api/settings/presets", async (httpReq, httpRes) => {
    if (!(await enterFnbStaff(httpReq, httpRes))) return;
    try {
      const session = await fnbNestSession(httpReq);
      const web = await runWithFnbTenant(session, async () => {
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

  
    const denied = denyUnlessPermission(session, PERMISSIONS.SCREEN_ADMIN_SETTINGS);
    if (denied) return denied;
    const body = patchSchema.parse(httpReq.body);
    const profile = await getFnbOrgProfile();
    const allowed = allowedFnbPresets(profile.edition);
    const outside = body.enabledPresets.filter((p) => !allowed.includes(p));
    if (outside.length > 0) {
      return sendJson(httpRes, { error: `FNB_PRESET_NOT_IN_EDITION: ${outside.join(", ")}` }, 403);
    }
    const shown = selectable(profile.edition);
    const kept = profile.enabledPresets.filter((p) => !shown.includes(p));
    const next = await setFnbEnabledPresets([...body.enabledPresets, ...kept]);
    return sendJson(httpRes, {
      edition: next.edition,
      enabledPresets: next.enabledPresets,
      selectablePresets: selectable(next.edition),
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
