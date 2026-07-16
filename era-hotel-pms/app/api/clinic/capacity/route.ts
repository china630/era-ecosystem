import { NextResponse } from 'next/server';
import { fetchClinicCapacitySummary } from '@/lib/integration/clinic-capacity-client';

/** Session proxy for ops UI — server holds CLINIC_BRIDGE_SECRET. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const date = url.searchParams.get('date');
  const ref = date ? new Date(date) : new Date();
  const summary = await fetchClinicCapacitySummary(ref);
  if (!summary) {
    return NextResponse.json({ riskLevel: 'ok', bookingAllowed: true, configured: false });
  }
  return NextResponse.json({ ...summary, configured: true });
}
