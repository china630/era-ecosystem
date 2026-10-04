import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  addEventOrderLine,
  deleteEventOrderLine,
  listEventOrderLines,
} from '@/lib/services/event-order.service';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { assertActiveHotelLookupCode } from '@/lib/services/master-data.service';

const createSchema = z.object({
  kind: z.string().trim().min(1).max(40).optional(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  revenueCodeId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const { id } = await ctx.params;
    return jsonOk(serialize(await listEventOrderLines(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const { id } = await ctx.params;
    const body = createSchema.parse(await req.json());
    if (body.kind) await assertActiveHotelLookupCode('EVENT_LINE_KIND', body.kind);
    return jsonOk(serialize(await addEventOrderLine({ ...body, banquetEventId: id })), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    await requireHotelModule('hotel_banquets', session.organizationId);
    const url = new URL(req.url);
    const lineId = url.searchParams.get('lineId');
    if (!lineId) throw new Error('lineId query param required');
    await deleteEventOrderLine(lineId);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
