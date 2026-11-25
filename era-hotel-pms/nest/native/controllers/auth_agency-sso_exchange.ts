/** Lifted from era-hotel-pms/nest/generated/auth_agency-sso_exchange.ts. Domain body unchanged. */
import { Controller, Get, Post, Put, Patch, Delete, HttpCode, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { agencySsoExchangeBodySchema, consumeSsoSignatureOnce, signAgencySession, verifyAgencySsoSignature, agencyAuthCookieName } from '@era/satellite-kit';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterSatelliteTenant } from '@era/satellite-kit';
import { findActiveAgencyForPortal } from '@/lib/services/hotel-auth.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithStaffTenantIfPresent, sendBytes, sendJson, cookieSeconds, sendRouteError } from "../../bridge";

/**
 * Agency portal SSO — distinct from staff/owner POST /api/auth/sso/exchange.
 * Payload: agency|{email}|{organizationId}|{agencyId}|{expiresAt}|{jti}
 */


@Controller()
export class AuthAgencySsoExchangeController {
  @Post("api/auth/agency-sso/exchange")
  @HttpCode(200)
  async post_0(@Req() httpReq: Request, @Res({ passthrough: false }) httpRes: Response) {
    try {
      const web = await (async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {

  
    const body = agencySsoExchangeBodySchema.parse(httpReq.body);
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return sendJson(httpRes, { error: 'SSO token expired' }, 401);
    }

    const ok = verifyAgencySsoSignature({
      email: body.email,
      organizationId: body.organizationId,
      agencyId: body.agencyId,
      expiresAt: body.expiresAt,
      signature: body.signature,
      jti: body.jti,
    });
    if (!ok) {
      return sendJson(httpRes, { error: 'Invalid agency SSO signature' }, 401);
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      return sendJson(httpRes, { error: 'SSO ticket already used' }, 401);
    }

    const organizationId = body.organizationId;
    enterSatelliteTenant({ organizationId });
    await requireHotelModule('hotel_agency_portal', organizationId);

    const agency = await findActiveAgencyForPortal(organizationId, body.agencyId);
    if (!agency) {
      return sendJson(httpRes, { error: 'Agency not found' }, 404);
    }

    const email = body.email.trim().toLowerCase();
    const token = await signAgencySession({
      sub: `agency:${agency.id}:${email}`,
      actor: 'agency',
      email,
      fullName: body.fullName?.trim() || email.split('@')[0] || 'Agency',
      organizationId,
      agencyId: agency.id,
      agencyCode: agency.code,
    });

    const cookie = agencyAuthCookieName();
    cookieSeconds(httpRes, cookie, token, 60 * 60 * 8);
    return sendJson(httpRes, {
      agencyId: agency.id,
      agencyCode: agency.code,
      agencyName: agency.name,
      email,
    });
  
        });
      })();
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
    }
}
