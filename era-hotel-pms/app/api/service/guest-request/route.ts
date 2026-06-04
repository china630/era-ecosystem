import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceRequest } from '@/lib/services/service-work-order.service';

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  roomNumber: z.string().max(16).optional(),
  token: z.string().optional(),
});

/** Public guest service request (QR in room). Optional SERVICE_GUEST_TOKEN env. */
export async function POST(req: Request) {
  const expected = process.env.SERVICE_GUEST_TOKEN?.trim();
  const body = bodySchema.parse(await req.json());
  if (expected && body.token !== expected) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  let roomId: string | undefined;
  if (body.roomNumber) {
    const room = await import('@/lib/prisma').then((m) =>
      m.prisma.room.findFirst({
        where: { roomNumber: body.roomNumber },
        select: { id: true },
      }),
    );
    roomId = room?.id;
  }

  const row = await createServiceRequest({
    title: body.title,
    description: body.description,
    source: 'GUEST',
    roomId,
    location: body.roomNumber ? `Room ${body.roomNumber}` : undefined,
    reportedBy: 'guest-portal',
    category: 'guest_request',
    priority: 'NORMAL',
  });
  return NextResponse.json({ ok: true, id: row.id }, { status: 201 });
}
