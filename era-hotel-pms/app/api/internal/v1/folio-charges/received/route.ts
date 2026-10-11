import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { enterRequestTenant } from '@/lib/request-organization';

const bodySchema = z.object({
  organizationId: z.string().uuid(),
  externalRef: z.string().min(1),
});

function assertServiceToken(request: Request): boolean {
  const expected = process.env.SATELLITE_EVENT_SERVICE_TOKEN?.trim();
  if (!expected) return false;
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return token === expected;
}

/** Clinic check-in marks the existing folio line received. Amount stays the same. */
export async function POST(request: Request) {
  if (!assertServiceToken(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = bodySchema.parse(await request.json());
  enterRequestTenant(body.organizationId);
  const charge = await prisma.folioCharge.findFirst({
    where: { externalRef: body.externalRef },
  });
  if (!charge) return NextResponse.json({ error: 'Charge not found' }, { status: 404 });
  if (!charge.serviceReceivedAt) {
    await prisma.folioCharge.update({
      where: { id: charge.id },
      data: { serviceReceivedAt: new Date() },
    });
  }
  return NextResponse.json({ ok: true, chargeId: charge.id });
}
