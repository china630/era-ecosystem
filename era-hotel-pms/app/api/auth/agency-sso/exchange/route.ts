import {
  agencySsoExchangeBodySchema,
  consumeSsoSignatureOnce,
  satelliteOrganizationId,
  signAgencySession,
  verifyAgencySsoSignature,
  agencyAuthCookieName,
} from '@era/satellite-kit';
import { jsonOk, handleRouteError, jsonError } from '@/lib/api-utils';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { prisma } from '@/lib/prisma';

/**
 * Agency portal SSO — distinct from staff/owner POST /api/auth/sso/exchange.
 * Payload: agency|{email}|{organizationId}|{agencyId}|{expiresAt}|{jti}
 */
export async function POST(request: Request) {
  try {
    await requireHotelModule('hotel_agency_portal');
    const body = agencySsoExchangeBodySchema.parse(await request.json());
    if (body.expiresAt < Math.floor(Date.now() / 1000)) {
      return jsonError('SSO token expired', 401);
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
      return jsonError('Invalid agency SSO signature', 401);
    }
    if (!consumeSsoSignatureOnce(body.signature, body.expiresAt)) {
      return jsonError('SSO ticket already used', 401);
    }

    const deployOrg = satelliteOrganizationId();
    if (deployOrg && deployOrg !== 'demo-org' && body.organizationId !== deployOrg) {
      return jsonError('SSO organization mismatch', 401);
    }

    const agency = await prisma.agency.findFirst({
      where: { id: body.agencyId, active: true },
    });
    if (!agency) {
      return jsonError('Agency not found', 404);
    }

    const email = body.email.trim().toLowerCase();
    const token = await signAgencySession({
      sub: `agency:${agency.id}:${email}`,
      actor: 'agency',
      email,
      fullName: body.fullName?.trim() || email.split('@')[0] || 'Agency',
      organizationId: body.organizationId,
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
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (err) {
    return handleRouteError(err);
  }
}
