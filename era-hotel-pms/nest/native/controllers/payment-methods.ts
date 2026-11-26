/** Lifted from era-hotel-pms/nest/generated/payment-methods.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDeskPaymentMethods, hotelGuestTenders } from '@/lib/org-payment-methods';
import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import { requestOrganizationId } from '@/lib/request-organization';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PaymentMethodsController {
  @Get("api/payment-methods")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const guestOnly = requestUrl.searchParams.get('guest') === '1';
    const organizationId = requestOrganizationId();
    const locale = (nestHeader(httpReq, 'accept-language') ?? 'en').slice(0, 2);
    const loc = locale === 'az' || locale === 'ru' ? locale : 'en';

    if (paymentMethodsSynced(organizationId)) {
      const rows = listPaymentMethodsForSatellite({
        organizationId,
        satelliteKey: 'hotel',
      });
      const codes = guestOnly
        ? rows.filter(
            (r) =>
              r.code !== 'DEPOSIT' &&
              r.code !== 'CL_AGENCY' &&
              r.code !== 'CL_COMPANY' &&
              r.code !== 'COMPANY_ACCOUNT',
          )
        : rows;
      return sendJson(httpRes, {
        synced: true,
        methods: codes.map((row) => ({
          code: row.code,
          label: loc === 'az' ? row.nameAz : loc === 'ru' ? row.nameRu : row.nameEn,
          fiscalHint: row.fiscalHint,
          fiscalDeviceId: row.fiscalDeviceId,
        })),
      });
    }

    const codes = guestOnly ? hotelGuestTenders() : hotelDeskPaymentMethods();
    return sendJson(httpRes, {
      synced: false,
      methods: codes.map((code) => ({
        code,
        label: code,
        fiscalHint: code === 'CASH' ? 'CASH' : code === 'CARD' || code === 'EPOINT' ? 'CARD' : 'NONE',
        fiscalDeviceId: null,
      })),
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
