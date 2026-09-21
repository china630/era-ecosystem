import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  bookIbe,
  ibeCorsHeaders,
  ibeErrorStatus,
  ibePreflightHeaders,
  resolveIbeTenant,
} from '@/lib/channel/ibe.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { serialize } from '@/lib/serialize';

const bodySchema = z.object({
  holdId: z.string().uuid().optional(),
  roomTypeId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  from: z.string().min(8),
  nights: z.number().int().min(1).max(60),
  adults: z.number().int().min(1).max(12).optional(),
  children: z.number().int().min(0).max(12).optional(),
  guestName: z.string().min(1),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  paymentMethod: z.enum(['CASH', 'CARD', 'BANK_TRANSFER', 'COMPANY_ACCOUNT']).optional(),
});

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: ibePreflightHeaders(req.headers.get('origin')),
  });
}

export async function POST(req: Request) {
  try {
    const { origins, organizationId } = await resolveIbeTenant(req);
    await requireHotelModule('hotel_distribution', organizationId);
    const body = bodySchema.parse(await req.json());
    const idempotencyKey =
      req.headers.get('idempotency-key')?.trim() ||
      `auto-${body.roomTypeId}-${body.from}-${body.guestName}`.slice(0, 120);
    const result = await bookIbe({ ...body, idempotencyKey });
    return NextResponse.json(
      { ...serialize(result.reservation), idempotent: result.idempotent },
      {
        status: result.idempotent ? 200 : 201,
        headers: ibeCorsHeaders(origins, req.headers.get('origin')),
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IBE book failed';
    return NextResponse.json({ error: message }, { status: ibeErrorStatus(err) });
  }
}
