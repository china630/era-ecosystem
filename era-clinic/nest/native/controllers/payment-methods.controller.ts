import { Controller, Get, HttpCode, Req, UseGuards } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  nestHeader,
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { listPaymentMethodsForSatellite, paymentMethodsSynced } from '@era/satellite-kit';
import { requireClinicPermission } from '@/lib/api-utils';
import { CLINIC_PERMISSION } from '@/lib/auth/clinic-permissions';
import { clinicDeskPaymentMethods } from '@/lib/org-payment-methods';
import { requestOrganizationId } from '@/lib/request-organization';

@Controller()
export class PaymentMethodsController {

  @UseGuards(ClinicApiGuard)
  @Get("api/payment-methods")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_BILLING_READ);
    if (denied) return clinicBody(denied);

    const organizationId = requestOrganizationId();
    const locale = (nestHeader(httpReq, 'accept-language') ?? 'en').slice(0, 2);
    const loc = locale === 'az' || locale === 'ru' ? locale : 'en';
    if (paymentMethodsSynced(organizationId)) {
      const rows = listPaymentMethodsForSatellite({
        organizationId,
        satelliteKey: 'clinic',
      });
      return {
        synced: true,
        methods: rows.map((row) => ({
          code: row.code,
          label: loc === 'az' ? row.nameAz : loc === 'ru' ? row.nameRu : row.nameEn,
        })),
      };
    }
    return {
      synced: false,
      methods: clinicDeskPaymentMethods().map((code) => ({ code, label: code })),
    };
  
        });
  }
}
