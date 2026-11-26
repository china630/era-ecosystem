/** Lifted from era-hotel-pms/nest/generated/folios_settle.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { settleFolio, getFolioSettlementPreview } from '@/lib/services/folio-settlement.service';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const lineSchema = z.object({
  method: z.enum([
    'CASH',
    'CARD',
    'COMPANY_ACCOUNT',
    'LOYALTY_POINTS',
    'DEPOSIT',
    'BANK_TRANSFER',
  ]),
  amount: z.number().positive(),
  registerRef: z.string().optional(),
  bankReference: z.string().max(120).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
  loyaltyCustomerRef: z.string().optional(),
  authorizationId: z.string().uuid().optional(),
});

const settleSchema = z.object({
  folioId: z.string().uuid(),
  lines: z.array(lineSchema).min(1),
  discountAmount: z.number().positive().optional(),
  discountDescription: z.string().max(200).optional(),
  applyDeposits: z.boolean().optional(),
});


@Controller()
export class FoliosSettleController {
  @Get("api/folios/settle")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const folioId = requestUrl.searchParams.get('folioId');
    if (!folioId) throw new Error('folioId required');
    return sendJson(httpRes, serialize(await getFolioSettlementPreview(folioId)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/folios/settle")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
    const body = settleSchema.parse(httpReq.body);
    return sendJson(httpRes, 
      serialize(await settleFolio({ ...body, createdByUserId: session?.sub, auditRequest: { headers: { get: (name: string) => nestHeader(httpReq, name) } } })),
      201,
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
