import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { listGroupReservationsWithBalance } from '@/lib/services/reports.service';
import { prisma } from '@/lib/prisma';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const createSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().optional(),
  agencyId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    return jsonOk(serialize(await listGroupReservationsWithBalance()));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(await request.json());
    const group = await prisma.reservationGroup.create({
      data: {
        code: body.code,
        name: body.name,
        agencyId: body.agencyId,
      },
    });
    return jsonOk(serialize(group), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
