/** Lifted from era-hotel-pms/nest/generated/admin_travel-agencies__id_portal-invite.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { z } from 'zod';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { findAgencyById } from '@/lib/services/agency-portal.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError } from "../../bridge";

const inviteSchema = z.object({
  email: z.string().email(),
  fullName: z.string().optional(),
  password: z.string().min(8).optional(),
});

/**
 * SatAdmin invites agency portal user — requires VÖEN on agency + hotel_agency_portal module.
 */


@Controller()
export class AdminTravelAgenciesIdPortalInviteController {
  @Post("api/admin/travel-agencies/:id/portal-invite")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    if (!(await enterHotelStaff(httpReq, httpRes))) return;
    try {
      const session = await hotelNestSession(httpReq);
      const web = await runWithHotelTenant(session, async () => {

  
    assertPermission(session, PERMISSIONS.PARTIES_MANAGE);
    await requireHotelModule('hotel_agency_portal', session.organizationId);
    await requireHotelModule('hotel_distribution', session.organizationId);

    const { id } = httpReq.params;
    const agency = await findAgencyById(id);
    if (!agency) return sendJson(httpRes, { error: 'Agency not found' }, 404);
    const voen = (agency.voen ?? '').replace(/\D/g, '');
    if (voen.length !== 10) {
      return sendJson(httpRes, { error: 'Agency VÖEN (10 digits) is required for portal invite' }, 400);
    }

    const body = inviteSchema.parse(httpReq.body);
    const orch =
      process.env.CONTROL_PLANE_URL?.replace(/\/$/, '') ||
      process.env.ORCHESTRATOR_URL?.replace(/\/$/, '');
    const token = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
    if (!orch || !token) {
      return sendJson(httpRes, { error: 'Orchestrator URL / service token not configured' }, 503);
    }

    const res = await fetch(`${orch}/agency-portal/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        organizationId: session.organizationId,
        email: body.email,
        fullName: body.fullName,
        password: body.password,
        agencyVoen: voen,
        localAgencyId: agency.id,
        localAgencyCode: agency.code,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      return sendJson(httpRes, { error: text || 'Invite failed' }, res.status);
    }
    return sendJson(httpRes, JSON.parse(text));
  
      });
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
