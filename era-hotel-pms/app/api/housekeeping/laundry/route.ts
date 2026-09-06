import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertAnyPermission, assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  createLaundryTicket,
  deliverLaundryTicket,
  ensureNaftaLaundryCatalog,
  getHkHotelPolicy,
} from '@/lib/services/hk-nafta.service';
import { prisma } from '@/lib/prisma';
import { toDecimal } from '@/lib/decimal';

function laundryReadWritePerms() {
  return [PERMISSIONS.HOUSEKEEPING_MANAGE, PERMISSIONS.FOLIO_CHARGE] as const;
}

export async function GET(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertAnyPermission(session, [...laundryReadWritePerms()]);
    await ensureNaftaLaundryCatalog();
    const reservationId = new URL(request.url).searchParams.get('reservationId');
    const items = await prisma.laundryItem.findMany({ where: { active: true }, orderBy: { code: 'asc' } });
    const tickets = await prisma.laundryTicket.findMany({
      where: reservationId ? { reservationId } : undefined,
      take: 80,
      orderBy: { createdAt: 'desc' },
      include: { lines: true },
    });
    const roomIds = [...new Set(tickets.map((tk) => tk.roomId))];
    const rooms = roomIds.length
      ? await prisma.room.findMany({
          where: { id: { in: roomIds } },
          select: { id: true, roomNumber: true },
        })
      : [];
    const roomNo = new Map(rooms.map((r) => [r.id, r.roomNumber]));
    const ticketsWithRoom = tickets.map((tk) => ({
      ...tk,
      roomNumber: roomNo.get(tk.roomId) ?? null,
    }));
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
    const policy = await getHkHotelPolicy();
    return jsonOk(
      serialize({
        items,
        tickets: ticketsWithRoom,
        stays,
        laundryExpressEnabled: policy.laundryExpressEnabled,
      }),
    );
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
  intakeNote: z.string().optional(),
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

const deliverBody = z.object({
  deliverTicketId: z.string().uuid(),
  returnScanKey: z.string().min(1),
  actorRole: z.enum(['HK', 'FO']).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    const body = await request.json();
    if (body.deliverTicketId) {
      assertAnyPermission(session, [...laundryReadWritePerms()]);
      const data = deliverBody.parse(body);
      const { hasPermission } = await import('@/lib/auth/permissions');
      const hk = session && hasPermission(session.role, PERMISSIONS.HOUSEKEEPING_MANAGE);
      const role: 'HK' | 'FO' = data.actorRole ?? (hk ? 'HK' : 'FO');
      return jsonOk(
        serialize(
          await deliverLaundryTicket({
            ticketId: data.deliverTicketId,
            actorUserId: session!.sub,
            actorRole: role,
            returnScanKey: data.returnScanKey,
          }),
        ),
      );
    }
    assertPermission(session, PERMISSIONS.HOUSEKEEPING_MANAGE);
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
    const ticket = await createLaundryTicket({
      roomId: data.roomId,
      reservationId: data.reservationId,
      guestName: data.guestName,
      express: data.express,
      now: new Date(),
      lines: data.lines,
    });
    return jsonOk(serialize(ticket));
  } catch (err) {
    return handleRouteError(err);
  }
}
