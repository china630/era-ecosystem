import { z } from "zod";
import { findB2BOrderByOrderNumber, listPickListsWithWaveCode, upsertPickListForWave } from "@/lib/pick-waves.service";
import { enterWholesaleStaff, wholesaleNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithWholesaleTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  waveCode: z.string().min(1),
  orderNumbers: z.array(z.string()).min(1),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/pick-waves", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const lists = await listPickListsWithWaveCode();
    const byWave = new Map<string, typeof lists>();
    for (const pl of lists) {
      const key = pl.waveCode ?? "UNASSIGNED";
      const arr = byWave.get(key) ?? [];
      arr.push(pl);
      byWave.set(key, arr);
    }
    const waves = [...byWave.entries()].map(([waveCode, pickLists]) => ({
      waveCode,
      pickListCount: pickLists.length,
      pickLists,
    }));
    return sendJson(httpRes, waves);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/pick-waves", async (httpReq, httpRes) => {
    if (!(await enterWholesaleStaff(httpReq, httpRes))) return;
    try {
      const session = await wholesaleNestSession(httpReq);
      const web = await runWithWholesaleTenant(session, async () => {
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

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = createSchema.parse(httpReq.body);
    const results = [];
    for (const orderNumber of body.orderNumbers) {
      const order = await findB2BOrderByOrderNumber(orderNumber);
      if (!order) continue;
      const pl = await upsertPickListForWave(order.id, body.waveCode);
      results.push(pl);
    }
    return sendJson(httpRes, { waveCode: body.waveCode, pickLists: results }, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
