import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { createMigrationRegistration } from '@/lib/services/migration-registration.service';
import { prisma } from '@/lib/prisma';

const createSchema = z.object({
  guestId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
});

export async function GET() {
  try {
    await requireHotelModule('hotel_migration_pro');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const rows = await prisma.migrationRegistration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { guest: { select: { id: true, fullName: true } } },
    });
    return jsonOk(serialize(rows));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    await requireHotelModule('hotel_migration_pro');
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const body = createSchema.parse(await request.json());
    const row = await createMigrationRegistration(body);
    return jsonOk(serialize(row), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
