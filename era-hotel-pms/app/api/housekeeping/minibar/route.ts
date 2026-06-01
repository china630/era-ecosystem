import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listMinibarItems, postMinibar } from '@/lib/services/wave-b-master.service';
import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const items = await listMinibarItems();
    const rooms = await prisma.room.findMany({
      where: { status: { in: ['AVAILABLE', 'CLEAN', 'INSPECTED', 'DIRTY'] } },
      orderBy: { roomNumber: 'asc' },
      take: 100,
    });
    return jsonOk(serialize({ items, rooms }));
  } catch (err) {
    return handleRouteError(err);
  }
}

const postSchema = z.object({
  roomId: z.string().uuid(),
  itemId: z.string().uuid(),
  qty: z.number().int().min(1).default(1),
  reservationId: z.string().uuid().optional(),
});

const itemSchema = z.object({
  code: z.string(),
  name: z.string(),
  price: z.number().positive(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = await request.json();
    if (body.code && body.name) {
      const parsed = itemSchema.parse(body);
      const item = await prisma.minibarItem.create({
        data: { code: parsed.code, name: parsed.name, price: toDecimal(parsed.price) },
      });
      return jsonOk(serialize(item));
    }
    const parsed = postSchema.parse(body);
    return jsonOk(serialize(await postMinibar(parsed)));
  } catch (err) {
    return handleRouteError(err);
  }
}
