import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { hotelDateKey } from '@/lib/hotel-calendar';
import { closeCashDeskRow, listCashDesk } from '@/lib/services/cash-desk.service';

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.FOLIO_READ);
    const date = new URL(request.url).searchParams.get('date') || hotelDateKey();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return jsonOk({ error: 'Invalid date' }, 400);
    }
    return jsonOk(serialize(await listCashDesk(date)));
  } catch (err) {
    return handleRouteError(err);
  }
}

const closeSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  payingDepartment: z.string().min(1),
  tender: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.CASH_SHIFT);
    const body = closeSchema.parse(await request.json());
    await closeCashDeskRow({
      businessDate: body.date,
      payingDepartment: body.payingDepartment,
      tender: body.tender,
    });
    return jsonOk(serialize(await listCashDesk(body.date)));
  } catch (err) {
    return handleRouteError(err);
  }
}
