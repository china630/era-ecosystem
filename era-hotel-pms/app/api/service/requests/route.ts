import { NextResponse } from 'next/server';
import { z } from 'zod';
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
  await requireHotelModule('hotel_service');
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? undefined;
  const rows = await listServiceRequests(status);
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  await requireHotelModule('hotel_service');
  const body = createSchema.parse(await req.json());
  const row = await createServiceRequest(body);
  return NextResponse.json(row, { status: 201 });
}
