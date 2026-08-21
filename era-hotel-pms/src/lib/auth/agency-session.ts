import { agencyAuthCookieName, verifyAgencySession, type AgencySessionPayload } from '@era/satellite-kit';
import { cookies, headers } from 'next/headers';

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
