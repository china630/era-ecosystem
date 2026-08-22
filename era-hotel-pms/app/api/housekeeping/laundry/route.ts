import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { postLaundryTicket } from '@/lib/services/hk-nafta.service';
import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const items = await prisma.laundryItem.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
    const tickets = await prisma.laundryTicket.findMany({
      take: 50,
      orderBy: { createdAt: 'desc' },
      include: { lines: true },
    });
    return jsonOk(serialize({ items, tickets }));
  } catch (err) {
    return handleRouteError(err);
  }
}

const createItem = z.object({
  code: z.string(),
  name: z.string(),
  washPrice: z.number(),
  ironPrice: z.number(),
  category: z.string().optional(),
});

const createTicket = z.object({
  roomId: z.string().uuid(),
  reservationId: z.string().uuid().optional(),
  guestName: z.string(),
  express: z.boolean().optional(),
  lines: z.array(
    z.object({
      itemId: z.string().uuid(),
      washQty: z.number().int().min(0),
      ironQty: z.number().int().min(0),
      guestQty: z.number().int().min(0).optional(),
      hotelQty: z.number().int().min(0).optional(),
    }),
  ),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
    const body = await request.json();
    if (body.postTicketId) {
      return jsonOk(serialize(await postLaundryTicket(String(body.postTicketId))));
    }
    if (body.code && body.name) {
      const data = createItem.parse(body);
      const item = await prisma.laundryItem.create({
        data: {
          code: data.code,
          name: data.name,
          washPrice: toDecimal(data.washPrice),
          ironPrice: toDecimal(data.ironPrice),
          category: data.category ?? 'GENTLEMEN',
        },
      });
      return jsonOk(serialize(item));
    }
    const data = createTicket.parse(body);
    const ticket = await prisma.laundryTicket.create({
      data: {
        roomId: data.roomId,
        reservationId: data.reservationId,
        guestName: data.guestName,
        express: data.express ?? false,
        status: 'ACCEPTED',
        lines: {
          create: data.lines.map((l) => ({
            itemId: l.itemId,
            washQty: l.washQty,
            ironQty: l.ironQty,
            guestQty: l.guestQty ?? l.washQty + l.ironQty,
            hotelQty: l.hotelQty ?? l.washQty + l.ironQty,
          })),
        },
      },
      include: { lines: true },
    });
    return jsonOk(serialize(ticket));
  } catch (err) {
    return handleRouteError(err);
  }
}
