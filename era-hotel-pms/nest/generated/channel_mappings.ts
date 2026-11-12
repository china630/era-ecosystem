import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createChannel, listChannels } from '@/lib/services/wave-b-master.service';
import { createChannelRateMapping, createChannelRoomMapping } from '@/lib/services/channel.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const channelSchema = z.object({ code: z.string().min(1), name: z.string().min(1) });

const roomMappingSchema = z.object({
  channelId: z.string().uuid(),
  roomTypeId: z.string().uuid(),
  otaRoomCode: z.string().min(1).optional(),
});

const rateMappingSchema = z.object({
  channelId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  otaRateCode: z.string().min(1).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/channel/mappings", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    return sendJson(httpRes, serialize(await listChannels()));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/channel/mappings", async (httpReq, httpRes) => {
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

  
    assertPermission(session, PERMISSIONS.CHANNEL_MANAGE);
    await requireHotelModule('hotel_distribution', session.organizationId);
    const body = httpReq.body;
    if (body.channelId && body.ratePlanId) {
      const parsed = rateMappingSchema.parse(body);
      const row = await createChannelRateMapping({
        channelId: parsed.channelId,
        ratePlanId: parsed.ratePlanId,
        otaRateCode: parsed.otaRateCode,
      });
      return sendJson(httpRes, serialize(row));
    }
    if (body.channelId && body.roomTypeId) {
      const parsed = roomMappingSchema.parse(body);
      const row = await createChannelRoomMapping({
        channelId: parsed.channelId,
        roomTypeId: parsed.roomTypeId,
        otaRoomCode: parsed.otaRoomCode,
      });
      return sendJson(httpRes, serialize(row));
    }
    const parsed = channelSchema.parse(body);
    return sendJson(httpRes, serialize(await createChannel(parsed)));
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
