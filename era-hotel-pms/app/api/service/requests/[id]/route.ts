import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { updateServiceRequestStatus } from '@/lib/services/service-work-order.service';

const patchSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'DONE', 'CANCELLED']),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await requireHotelModule('hotel_service');
  const { id } = await params;
  const body = patchSchema.parse(await req.json());
  const row = await updateServiceRequestStatus(id, body.status);
  return NextResponse.json(row);
}
