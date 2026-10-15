import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { enterRequestTenant } from '@/lib/request-organization';

const bodySchema = z.object({
  organizationId: z.string().min(1),
  reservationIds: z.array(z.string().min(1)).max(200),
});

function assertServiceToken(request: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === expected;
}

/** Which of these reservations are already CHECKED_OUT. Planned date is ignored. */
export async function POST(request: Request) {
  if (!assertServiceToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = bodySchema.parse(await request.json());
  enterRequestTenant(body.organizationId);
  const rows = await prisma.reservation.findMany({
    where: { id: { in: body.reservationIds }, status: 'CHECKED_OUT' },
    select: { id: true },
  });
  return NextResponse.json({ ids: rows.map((row) => row.id) });
}
