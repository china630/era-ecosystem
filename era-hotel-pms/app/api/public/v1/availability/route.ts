import { NextResponse } from 'next/server';
import {
  IbeAuthError,
  IbeForbiddenError,
  ibeCorsHeaders,
  ibeErrorStatus,
  ibePreflightHeaders,
  resolveIbeTenant,
  searchIbeAvailability,
} from '@/lib/channel/ibe.service';
import { todayBakuYmd } from '@era/satellite-kit/time';
import { requireHotelModule } from '@/lib/hotel-module-gate';

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: ibePreflightHeaders(req.headers.get('origin')),
  });
}

export async function GET(req: Request) {
  try {
    const { origins, organizationId } = await resolveIbeTenant(req);
    await requireHotelModule('hotel_distribution', organizationId);
    const url = new URL(req.url);
    const from = url.searchParams.get('from') ?? todayBakuYmd();
    const nights = Number(url.searchParams.get('nights') ?? '1');
    const adults = Number(url.searchParams.get('adults') ?? '1');
    const children = Number(url.searchParams.get('children') ?? '0');
    const result = await searchIbeAvailability({ from, nights, adults, children });
    return NextResponse.json(result, {
      headers: ibeCorsHeaders(origins, req.headers.get('origin')),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'IBE availability failed';
    return NextResponse.json({ error: message }, { status: ibeErrorStatus(err) });
  }
}
