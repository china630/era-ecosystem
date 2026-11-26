/** Lifted from era-hotel-pms/nest/generated/settlement_pending.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { createPendingCharge } from '@/lib/services/settlement-hub.service';
import { enterSatelliteTenant, satelliteRuntimeConfig } from '@era/satellite-kit';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const schema = z
  .object({
    sourceSystem: z.enum(['FNB_POS', 'CLINIC', 'RETAIL']),
    sourceOrgId: z.string().min(1),
    hotelOrganizationId: z.string().uuid().optional(),
    sourceRef: z.string().min(1),
    amount: z.number().finite(),
    sku: z.string().min(1).optional(),
    qty: z.number().int().refine((qty) => qty !== 0).optional(),
    revenueCode: z.string().min(1).max(32).optional(),
    currency: z.string().default('AZN'),
    description: z.string().min(1),
    payerLabel: z.string().optional(),
    globalPersonId: z.string().optional(),
    reservationId: z.string().uuid().optional(),
    basketRef: z.string().min(1).max(64).optional(),
  })
  .superRefine((body, ctx) => {
    if (body.amount !== 0 && !body.revenueCode?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['revenueCode'],
        message: 'revenueCode is required when amount is not zero',
      });
    }
  });


@Controller()
export class SettlementPendingController {
  @Post("api/settlement/pending")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.FOLIO_PAYMENT);
    const body = schema.parse(httpReq.body);
    const orgFromHeader = nestHeader(httpReq, 'x-era-organization-id')?.trim();
    const hotelOrganizationId = body.hotelOrganizationId?.trim() || orgFromHeader || '';
    if (satelliteRuntimeConfig().deploymentTopology === 'SHARED' && !hotelOrganizationId) {
      return sendJson(httpRes, 
        { error: 'hotelOrganizationId required on SHARED pool' }, 400);
    }
    if (hotelOrganizationId) {
      enterSatelliteTenant({ organizationId: hotelOrganizationId });
    }
    const headerKey = nestHeader(httpReq, 'idempotency-key')?.trim();
    const idempotencyKey =
      headerKey || `${body.sourceSystem.toLowerCase()}-${body.sourceRef}`;
    const { hotelOrganizationId: _hotelOrganizationId, ...charge } = body;

    const result = await createPendingCharge({
      ...charge,
      idempotencyKey,
    });

    return sendJson(httpRes, 
      serialize({
        ...result.charge,
        idempotent: result.idempotent,
      }),
      result.idempotent ? 200 : 201,
    );
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Get("api/settlement/pending")
  @HttpCode(200)
  async get_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    await assertPosBridgeOrPermission({ headers: { get: (name: string) => nestHeader(httpReq, name) }, url: new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1").toString() }, PERMISSIONS.FOLIO_PAYMENT);
    const url = requestUrl;
    const status = (url.searchParams.get('status') ?? 'PENDING') as
      | 'PENDING'
      | 'PAID'
      | 'VOID';
    const { listPendingCharges } = await import('@/lib/services/settlement-hub.service');
    const rows = await listPendingCharges(status);
    return sendJson(httpRes, serialize(rows));
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
