import { NextResponse } from 'next/server';
import { getSatelliteSession } from '@/lib/auth/session';
import { handleRouteError, jsonError } from '@/lib/api-utils';
import { fetchClinicCapacitySummary } from '@/lib/integration/clinic-capacity-client';

/** Session proxy for ops UI - server holds CLINIC_BRIDGE_SECRET. */
export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError('Unauthorized', 401);
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const ref = date ? new Date(date) : new Date();
    const summary = await fetchClinicCapacitySummary(session.organizationId, ref);
    if (!summary) {
      return NextResponse.json({ riskLevel: 'ok', bookingAllowed: true, configured: false });
    }
    return NextResponse.json({ ...summary, configured: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
