/** Lifted from nest/generated/payment-methods.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import { fnbDeskPaymentMethods } from '@/lib/org-payment-methods';
import { requestOrganizationId } from '@/lib/request-organization';
import { enterFnbStaff, fnbNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithFnbTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";




@Controller()
export class PaymentMethodsController {
  @Get("api/payment-methods")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      

  const organizationId = requestOrganizationId();
  const locale = (nestHeader(httpReq, 'accept-language') ?? 'en').slice(0, 2);
  const loc = locale === 'az' || locale === 'ru' ? locale : 'en';
  if (paymentMethodsSynced(organizationId)) {
    const rows = listPaymentMethodsForSatellite({
      organizationId,
      satelliteKey: 'fnb',
    });
    return sendJson(httpRes, {
      synced: true,
      methods: rows.map((row) => ({
        code: row.code,
        label: loc === 'az' ? row.nameAz : loc === 'ru' ? row.nameRu : row.nameEn,
        fiscalHint: row.fiscalHint,
      })),
    });
  }
  return sendJson(httpRes, {
    synced: false,
    methods: fnbDeskPaymentMethods().map((code) => ({
      code,
      label: code,
      fiscalHint: code === 'CASH' ? 'CASH' : code === 'CARD' ? 'CARD' : 'NONE',
    })),
  });

        });
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  }
}
