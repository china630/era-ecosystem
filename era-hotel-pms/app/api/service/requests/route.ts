import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleRouteError, jsonError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import {
  createServiceRequest,
  listServiceRequests,
} from '@/lib/services/service-work-order.service';

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH']).optional(),
  source: z.enum(['GUEST', 'STAFF', 'RECURRING']).optional(),
  roomId: z.string().uuid().optional(),
  location: z.string().optional(),
  reportedBy: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError('Unauthorized', 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const url = new URL(req.url);
    const status = url.searchParams.get('status') ?? undefined;
    const rows = await listServiceRequests(status);
    return NextResponse.json(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError('Unauthorized', 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const body = createSchema.parse(await req.json());
    const row = await createServiceRequest(body);
    return NextResponse.json(row, { status: 201 });
  } catch (err) {
    return handleRouteError(err);
  }
}
