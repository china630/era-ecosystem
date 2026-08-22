import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { postLaundryTicket, resolveStayForRoom, laundryIntakeBlockReason, isoDay } from '@/lib/services/hk-nafta.service';
import { getCalendarDaysRange } from '@era/satellite-kit';
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
    const stays = await prisma.reservation.findMany({
      where: { status: { in: ['IN_HOUSE', 'CONFIRMED'] } },
      select: {
        id: true,
        roomId: true,
        status: true,
        guest: { select: { fullName: true } },
        room: { select: { id: true, roomNumber: true } },
      },
      take: 400,
    });
    return jsonOk(serialize({ items, tickets, stays }));
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
  guestName: z.string().optional(),
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
    const stay = data.reservationId
      ? await prisma.reservation.findUnique({ where: { id: data.reservationId }, include: { guest: true } })
      : await resolveStayForRoom(data.roomId);
    if (!stay) throw new Error('In-house or arriving reservation required');
    let dayType: string | null = null;
    try {
      const days = await getCalendarDaysRange(isoDay(new Date()), isoDay(new Date()));
      dayType = days[0]?.dayType ?? null;
    } catch {
      dayType = null;
    }
    const blocked = laundryIntakeBlockReason({ now: new Date(), express: data.express ?? false, dayType });
    if (blocked) throw new Error(blocked);
    const ticket = await prisma.laundryTicket.create({
      data: {
        roomId: data.roomId,
        reservationId: stay.id,
        guestName: data.guestName || stay.guest.fullName,
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
