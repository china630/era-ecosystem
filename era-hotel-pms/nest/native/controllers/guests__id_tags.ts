/** Lifted from era-hotel-pms/nest/generated/guests__id_tags.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createGuestTag, deleteGuestTag, listGuestTags } from '@/lib/services/guest-crm.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z.object({ name: z.string().min(1) });


@Controller()
export class GuestsIdTagsController {
  @Get("api/guests/:id/tags")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_READ);
    const { id } = httpReq.params;
    return sendJson(httpRes, serialize(await listGuestTags(id)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/guests/:id/tags")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const { id } = httpReq.params;
    const body = schema.parse(httpReq.body);
    return sendJson(httpRes, serialize(await createGuestTag(id, body.name)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Delete("api/guests/:id/tags")
  @HttpCode(200)
  async delete_2(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.GUESTS_WRITE);
    const { id } = httpReq.params;
    const tagId = requestUrl.searchParams.get('tagId');
    if (!tagId) throw new Error('tagId required');
    await deleteGuestTag(tagId, id);
    return sendJson(httpRes, { ok: true });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
