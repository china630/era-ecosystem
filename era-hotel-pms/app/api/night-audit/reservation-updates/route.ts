import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { bakuDayBounds, todayBakuYmd } from '@era/satellite-kit/time';
import {
  listNightAuditReservationUpdates,
  reservationUpdatesToCsv,
  type UpdateActionKind,
} from '@/lib/services/night-audit-updates.service';

const actionSchema = z.enum(['ALL', 'CANCEL', 'EXTEND', 'NOTE', 'OTHER']);

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.REPORTS_READ);
    const url = new URL(request.url);
    const today = todayBakuYmd();
    const from = bakuDayBounds(url.searchParams.get('from') ?? today).start;
    const to = bakuDayBounds(url.searchParams.get('to') ?? today).start;
    const action = actionSchema.parse(url.searchParams.get('action') ?? 'ALL') as UpdateActionKind;
    const rows = await listNightAuditReservationUpdates({ from, to, action });
    if (url.searchParams.get('format') === 'csv') {
      const csv = reservationUpdatesToCsv(rows);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="reservation-updates-${url.searchParams.get('from') ?? today}.csv"`,
        },
      });
    }
    return jsonOk(serialize(rows));
  } catch (err) {
    return handleRouteError(err);
  }
}
