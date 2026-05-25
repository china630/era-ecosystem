import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import {
  createBanquetEvent,
  listBanquetEvents,
  listBanquetMeta,
} from '@/lib/services/banquet.service';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const createSchema = z.object({
  eventName: z.string().min(1),
  saloonId: z.string().uuid(),
  menuPackageId: z.string().uuid().optional(),
  reservationId: z.string().uuid().optional(),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pax: z.number().int().positive(),
  advanceAmount: z.number().nonnegative().optional(),
  contactName: z.string().optional(),
  notes: z.string().optional(),
  referenceNo: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);

    const url = new URL(req.url);
    const status = url.searchParams.get('status') ?? undefined;
    const fromStr = url.searchParams.get('from');
    const toStr = url.searchParams.get('to');

    const [meta, events] = await Promise.all([
      listBanquetMeta(),
      listBanquetEvents({
        status,
        from: fromStr ? new Date(fromStr) : undefined,
        to: toStr ? new Date(toStr) : undefined,
      }),
    ]);

    return jsonOk(serialize({ ...meta, events }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(await req.json());

    const created = await createBanquetEvent({
      ...body,
      eventDate: new Date(body.eventDate),
    });

    return jsonOk(serialize(created), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
