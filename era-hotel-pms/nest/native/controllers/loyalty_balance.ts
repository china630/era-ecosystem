/** Lifted from era-hotel-pms/nest/generated/loyalty_balance.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { requestOrganizationId } from '@/lib/request-organization';
import { serialize } from '@/lib/serialize';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const CP_URL = process.env.CONTROL_PLANE_URL?.replace(/\/$/, '');
const CP_TOKEN =
  process.env.CONTROL_PLANE_SERVICE_TOKEN?.trim() ||
  process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();


@Controller()
export class LoyaltyBalanceController {
  @Get("api/loyalty/balance")
  @HttpCode(200)
  async get_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const customerRef = requestUrl.searchParams.get('customerRef');
    if (!customerRef) throw new Error('customerRef required');

    const orgId = requestOrganizationId();
    if (!CP_URL || !CP_TOKEN || !orgId || orgId === 'demo-org') {
      return sendJson(httpRes, { balance: 0, maxRedeemableAzn: 0, mode: 'mock', pointsPerAzn: 100 });
    }

    const res = await fetch(
      `${CP_URL}/api/platform/loyalty/v1/points/balance?customerRef=${encodeURIComponent(customerRef)}`,
      {
        headers: {
          Authorization: `Bearer ${CP_TOKEN}`,
          'X-Organization-Id': orgId,
        },
      },
    );
    if (!res.ok) throw new Error('Balance lookup failed');
    const data = (httpReq.body) as { balance?: number };
    const points = data.balance ?? 0;
    const pointsPerAzn = Number(process.env.LOYALTY_POINTS_PER_AZN ?? '100');
    return sendJson(httpRes, {
      balance: points,
      maxRedeemableAzn: Math.floor(points / pointsPerAzn),
      pointsPerAzn,
      mode: 'live',
    });
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
