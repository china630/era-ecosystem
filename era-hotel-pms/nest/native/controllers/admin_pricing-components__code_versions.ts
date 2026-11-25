/** Lifted from era-hotel-pms/nest/generated/admin_pricing-components__code_versions.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertMasterDataRead, assertMasterDataWrite } from '@/lib/auth/master-data-guard';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { addPricingComponentVersion, getPricingComponent } from '@/lib/services/pricing-components.service';
import { recordHotelAudit } from '@/lib/satellite-audit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  sellAmount: z.number().nonnegative().nullable().optional(),
  cogsAmount: z.number().nonnegative().nullable().optional(),
  effectiveFrom: z.string().min(8),
  note: z.string().max(500).nullable().optional(),
});


@Controller()
export class AdminPricingComponentsCodeVersionsController {
  @Get("api/admin/pricing-components/:code/versions")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataRead(session, PERMISSIONS.PRICING_ADMIN);
    const { code } = httpReq.params;
    return sendJson(httpRes, serialize(await getPricingComponent(code)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/admin/pricing-components/:code/versions")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertMasterDataWrite(session, PERMISSIONS.PRICING_ADMIN);
    const { code } = httpReq.params;
    const body = bodySchema.parse(httpReq.body);
    if (body.sellAmount == null && body.cogsAmount == null) {
      throw new Error('Provide sellAmount and/or cogsAmount');
    }
    if (!session) throw new Error('Unauthorized');
    const version = await addPricingComponentVersion({
      code,
      sellAmount: body.sellAmount,
      cogsAmount: body.cogsAmount,
      effectiveFrom: new Date(body.effectiveFrom),
      note: body.note,
      createdById: session.sub,
    });
    await recordHotelAudit(
      { userId: session.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
      'PricingComponent',
      code,
      'VERSION_CREATE',
      version as unknown as Record<string, unknown>,
    );
    return sendJson(httpRes, serialize(version), 201);
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
