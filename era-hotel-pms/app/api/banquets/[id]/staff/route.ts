import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  deleteEventStaffAssignment,
  listEventStaffAssignments,
  upsertEventStaffAssignment,
} from '@/lib/services/event-order.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  role: z.string().min(1),
  staffName: z.string().min(1),
  shiftStart: z.coerce.date().optional(),
  shiftEnd: z.coerce.date().optional(),
  status: z.enum(['PLANNED', 'DONE', 'CANCELLED']).optional(),
  notes: z.string().optional(),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireHotelModule('hotel_banquets');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await ctx.params;
    return jsonOk(serialize(await listEventStaffAssignments(id)));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireHotelModule('hotel_banquets');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await ctx.params;
    const body = upsertSchema.parse(await req.json());
    return jsonOk(serialize(await upsertEventStaffAssignment({ ...body, banquetEventId: id })), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await requireHotelModule('hotel_banquets');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const url = new URL(req.url);
    const assignmentId = url.searchParams.get('assignmentId');
    if (!assignmentId) throw new Error('assignmentId query param required');
    await deleteEventStaffAssignment(assignmentId);
    return jsonOk({ deleted: true });
  } catch (err) {
    return handleRouteError(err);
  }
}
