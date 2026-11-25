/** Lifted from era-hotel-pms/nest/generated/folios.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { serialize } from '@/lib/serialize';
import { listFolios, postCharge, postPayment } from '@/lib/services/folio.service';
import { PAYMENT_CATEGORIES } from '@/lib/payment-category';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const chargeSchema = z.object({
  reservationId: z.string().uuid(),
  revenueCodeId: z.string().uuid(),
  amount: z.number(), // allow negative for DISCOUNT posts via API if needed
  qty: z.number().int().positive().optional(),
  description: z.string().min(1),
  folioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
  reservationGuestId: z.string().uuid().optional(),
});

const paymentSchema = z
  .object({
    folioId: z.string().uuid().optional(),
    reservationId: z.string().uuid().optional(),
    revenueCodeId: z.string().uuid().optional(),
    paymentCategory: z.enum(PAYMENT_CATEGORIES).optional(),
    amount: z.number().positive(),
    paymentMethod: z.string().min(1).max(64),
    registerRef: z.string().optional(),
    bankReference: z.string().max(120).optional(),
    bankTerminalId: z.string().min(1).max(64).optional(),
    folioType: z.enum(['GUEST', 'AGENCY', 'COMPANY']).optional(),
    reservationGuestId: z.string().uuid().optional(),
    /** Explicit prepay / credit when the stay still has open debt on other articles. */
    allowCredit: z.boolean().optional(),
  })
  .refine((row) => Boolean(row.folioId || row.reservationId), {
    message: 'folioId or reservationId is required',
  })
  .refine((row) => Boolean(row.folioId || row.revenueCodeId || row.paymentCategory), {
    message: 'revenueCodeId or paymentCategory is required for stay payment',
  });


@Controller()
export class FoliosController {
  @Get("api/folios")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const reservationId = requestUrl.searchParams.get('reservationId') ?? undefined;
    return sendJson(httpRes, serialize(await listFolios(reservationId)));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }

  @Post("api/folios")
  @HttpCode(200)
  async post_1(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    const body = httpReq.body;
    if (body.folioId || (body.reservationId && body.paymentMethod)) {
      assertPermission(session, PERMISSIONS.FOLIO_PAYMENT);
      const data = paymentSchema.parse(body);
      let folioId = data.folioId;
      if (!folioId && data.reservationId) {
        if (data.paymentCategory) {
          const { postStayCategoryPayment } = await import('@/lib/services/booking-folio.service');
          const payment = await postStayCategoryPayment({
            reservationId: data.reservationId,
            paymentCategory: data.paymentCategory,
            amount: data.amount,
            paymentMethod: data.paymentMethod,
            registerRef: data.registerRef,
            bankReference: data.bankReference,
            bankTerminalId: data.bankTerminalId,
            folioType: data.folioType,
            reservationGuestId: data.reservationGuestId,
            createdByUserId: session?.sub,
            auditRequest: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
          });
          return sendJson(httpRes, serialize(payment), 201);
        }
        if (!data.revenueCodeId) throw new Error('Revenue code is required');
        const { postStayArticlePayment } = await import('@/lib/services/booking-folio.service');
        const payment = await postStayArticlePayment({
          reservationId: data.reservationId,
          revenueCodeId: data.revenueCodeId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          registerRef: data.registerRef,
          bankReference: data.bankReference,
          bankTerminalId: data.bankTerminalId,
          explicit: data.folioType,
          reservationGuestId: data.reservationGuestId,
          allowCredit: data.allowCredit === true,
          createdByUserId: session?.sub,
          auditRequest: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
        });
        return sendJson(httpRes, serialize(payment), 201);
      }
      const payment = await postPayment({
        folioId: folioId!,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        registerRef: data.registerRef,
        bankReference: data.bankReference,
        bankTerminalId: data.bankTerminalId,
        revenueCodeId: data.revenueCodeId,
        allowCredit: data.allowCredit === true,
        createdByUserId: session?.sub,
        auditRequest: { headers: { get: (name: string) => nestHeader(httpReq, name) } },
      });
      return sendJson(httpRes, serialize(payment), 201);
    }
    assertPermission(session, PERMISSIONS.FOLIO_CHARGE);
    const data = chargeSchema.parse(body);
    return sendJson(httpRes, 
      serialize(
        await postCharge({
          ...data,
          folioType: data.folioType,
          reservationGuestId: data.reservationGuestId,
          audit: { userId: session?.sub, request: { headers: { get: (name: string) => nestHeader(httpReq, name) } } },
        }),
      ),
      201,
    );
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
