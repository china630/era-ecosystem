import {
  agencyAuthCookieName,
  enterSatelliteTenant,
  verifyAgencySession,
  type AgencySessionPayload,
} from '@era/satellite-kit';
import { cookies, headers } from 'next/headers';
import { requireHotelModule } from '@/lib/hotel-module-gate';

export async function getAgencySession(): Promise<AgencySessionPayload> {
  const jar = await cookies();
  const hdrs = await headers();
  const cookieToken = jar.get(agencyAuthCookieName())?.value;
  const auth = hdrs.get('authorization');
  const bearer =
    auth?.startsWith('Bearer ') ? auth.slice(7).trim() : undefined;
  const token = bearer || cookieToken;
  if (!token) {
    throw Object.assign(new Error('Agency session required'), { status: 401 });
  }
  try {
    return await verifyAgencySession(token);
  } catch {
    throw Object.assign(new Error('Invalid agency session'), { status: 401 });
  }
}

/** Agency session with its org entered and `hotel_agency_portal` checked for that org. */
export async function requireAgencyPortalSession(): Promise<AgencySessionPayload> {
  const session = await getAgencySession();
  enterSatelliteTenant({ organizationId: session.organizationId });
  await requireHotelModule('hotel_agency_portal', session.organizationId);
  return session;
}
