import { NextRequest, NextResponse } from 'next/server';
import { assertPosBridgeOrPermission } from '@/lib/pos-bridge-auth';
import { queryOccupancySeries } from '@/lib/services/reports/monthly-daily-analysis.report';

/**
 * S2S: daily pax series for F&B buffet guest-nights sync.
 * Uses occupancy series pax (adults+children), not stay-count guestNights.
 */
export async function GET(request: NextRequest) {
  const denied = await assertPosBridgeOrPermission(request);
  if (denied) return denied;

  const url = request.nextUrl;
  const from = url.searchParams.get('from')?.trim() ?? '';
  const to = url.searchParams.get('to')?.trim() ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json(
      { error: 'from and to (YYYY-MM-DD) are required', code: 'BAD_RANGE' },
      { status: 400 },
    );
  }
  if (from > to) {
    return NextResponse.json(
      { error: 'from must be ≤ to', code: 'BAD_RANGE' },
      { status: 400 },
    );
  }

  const series = await queryOccupancySeries(from, to);
  return NextResponse.json({
    from: series.from,
    to: series.to,
    days: series.days.map((d) => ({ date: d.date, pax: d.pax })),
  });
}
