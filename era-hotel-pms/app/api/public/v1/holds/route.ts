import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  createIbeHold,
  ibeCorsHeaders,
  ibeErrorStatus,
  ibePreflightHeaders,
  resolveIbeTenant,
} from '@/lib/channel/ibe.service';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { serialize } from '@/lib/serialize';

const bodySchema = z.object({
  roomTypeId: z.string().uuid(),
  ratePlanId: z.string().uuid(),
  from: z.string().min(8),
  nights: z.number().int().min(1).max(60),
  adults: z.number().int().min(1).max(12).optional(),
  children: z.number().int().min(0).max(12).optional(),
  ttlMinutes: z.number().int().min(5).max(60).optional(),
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
    const hold = await createIbeHold(body);
    return NextResponse.json(serialize(hold), {
      status: 201,
      headers: ibeCorsHeaders(origins, req.headers.get('origin')),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IBE hold failed';
    return NextResponse.json({ error: message }, { status: ibeErrorStatus(err) });
  }
}
