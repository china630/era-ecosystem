/** Lifted from era-hotel-pms/nest/generated/integration_erp_inbound.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { applyE6FiscalStatusChanged } from '@/lib/services/fiscal-document.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const e6Schema = z.object({
  eventType: z.literal('invoice_fiscal_status_changed'),
  invoiceRef: z.string().min(1),
  fiscalStatus: z.string().min(1),
  fiscalExternalId: z.string().optional(),
  rejectionReason: z.string().optional(),
  updatedAt: z.string().optional(),
});

function verifyErpToken(request: Request): boolean {
  const expected = process.env.ERP_INBOUND_WEBHOOK_SECRET;
  if (!expected) return process.env.NODE_ENV !== 'production';
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7) === expected;
  const header = request.headers.get('x-erp-webhook-secret');
  return header === expected;
}


@Controller()
export class IntegrationErpInboundController {
  @Post("api/integration/erp/inbound")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    if (!verifyErpToken({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() })) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }
    const body = e6Schema.parse(httpReq.body);
    const doc = await applyE6FiscalStatusChanged(body);
    return sendJson(httpRes, serialize({ applied: true, document: doc }));
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
