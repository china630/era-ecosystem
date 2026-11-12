import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listMinibarItems, postMinibar, listMinibarOpsBoard, createMinibarCatalogItem } from '@/lib/services/wave-b-master.service';
import { toDecimal } from '@/lib/decimal';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const postSchema = z.object({
  roomId: z.string().uuid(),
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).default(1),
  reservationId: z.string().uuid().optional(),
});

const itemSchema = z.object({
  code: z.string(),
  name: z.string(),
  price: z.number().positive(),
  financeSku: z.string().min(1).nullable().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/housekeeping/minibar", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const items = await listMinibarItems();
    const { rooms, postings } = await listMinibarOpsBoard();
    return sendJson(httpRes, serialize({ items, rooms, postings }));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/housekeeping/minibar", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = httpReq.body;
    if (body.code && body.name) {
      const parsed = itemSchema.parse(body);
      const item = await createMinibarCatalogItem({
        code: parsed.code,
        name: parsed.name,
        price: toDecimal(parsed.price),
        financeSku: parsed.financeSku?.trim() || null,
      });
      return sendJson(httpRes, serialize(item));
    }
    const parsed = postSchema.parse(body);
    return sendJson(httpRes, serialize(await postMinibar(parsed)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
