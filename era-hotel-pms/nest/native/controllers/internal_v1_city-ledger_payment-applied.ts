/** Lifted from era-hotel-pms/nest/generated/internal_v1_city-ledger_payment-applied.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { applyCityLedgerPaymentFromFinance } from '@/lib/services/city-ledger-gate.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const bodySchema = z.object({
  folioId: z.string().min(1),
  invoiceId: z.string().min(1),
  paymentId: z.string().min(1),
  amount: z.number().positive(),
  currency: z.literal('AZN'),
  fullyPaid: z.boolean(),
});

/**
 * Finance -> Hotel callback: apply allocated AR payment into hotel folio.
 * Idempotent by `paymentId` (stored into FolioPayment.registerRef).
 */


@Controller()
export class InternalV1CityLedgerPaymentAppliedController {
  @Post("api/internal/v1/city-ledger/payment-applied")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    const auth = nestHeader(httpReq, 'authorization')?.replace(/^Bearer\s+/i, '').trim();
    if (token && auth !== token) {
      return sendJson(httpRes, { error: 'Unauthorized' }, 401);
    }

    const body = bodySchema.parse(httpReq.body);

    const result = await applyCityLedgerPaymentFromFinance(body);
    if (result === null) {
      return sendJson(httpRes, { error: 'Folio not found' }, 404);
    }

    if (result.alreadyApplied) {
      return sendJson(httpRes, {
        id: result.id,
        paymentId: result.paymentId,
        folioId: result.folioId,
        balance: result.balance,
        status: result.status,
        alreadyApplied: true,
      });
    }

    return sendJson(httpRes, {
      id: result.id,
      paymentId: result.paymentId,
      folioId: result.folioId,
      balance: result.balance,
      status: result.status,
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
