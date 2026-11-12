import { agencySsoExchangeBodySchema, consumeSsoSignatureOnce, signAgencySession, verifyAgencySsoSignature, agencyAuthCookieName } from '@era/satellite-kit';
import { jsonOk } from '@/lib/api-utils';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { enterSatelliteTenant } from '@era/satellite-kit';
import { findActiveAgencyForPortal } from '@/lib/services/hotel-auth.service';
import { enterHotelStaff, hotelNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithHotelTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

/**
 * Agency portal SSO — distinct from staff/owner POST /api/auth/sso/exchange.
 * Payload: agency|{email}|{organizationId}|{agencyId}|{expiresAt}|{jti}
 */

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/auth/agency-sso/exchange", async (httpReq, httpRes) => {
    try {
      const web = await runWithNestHttp(httpReq, async () => {
        return runWithStaffTenantIfPresent(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
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
    const res = jsonOk({
      agencyId: agency.id,
      agencyCode: agency.code,
      agencyName: agency.name,
      email,
    });
    res.cookies.set(cookie, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
    return sendWebResponse(httpRes, res);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
