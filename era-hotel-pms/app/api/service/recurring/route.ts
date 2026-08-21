import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { prisma } from '@/lib/prisma';
import { runDueRecurringSchedules } from '@/lib/services/service-work-order.service';

const createSchema = z.object({
  title: z.string().min(1),
  category: z.string().optional(),
  cadence: z.enum([
    'DAILY',
    'WEEKLY',
    'MONTHLY',
    'QUARTERLY',
    'YEARLY',
    'DATE',
    'EVENT',
  ]),
  nextDueAt: z.string().datetime(),
  roomId: z.string().uuid().optional(),
  location: z.string().optional(),
  eventKey: z.string().optional(),
});

export async function GET() {
  await requireHotelModule('hotel_service');
  const rows = await prisma.recurringServiceSchedule.findMany({
    orderBy: { nextDueAt: 'asc' },
    take: 100,
  });
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  await requireHotelModule('hotel_service');
  const body = createSchema.parse(await req.json());
  const row = await prisma.recurringServiceSchedule.create({
    data: {
      title: body.title,
      category: body.category,
      cadence: body.cadence,
      nextDueAt: new Date(body.nextDueAt),
      roomId: body.roomId,
      location: body.location,
      eventKey: body.eventKey,
    },
  });
  return NextResponse.json(row, { status: 201 });
}

/** Cron hook: generate work orders for due schedules. */
export async function PUT(req: Request) {
  const secret = req.headers.get('x-service-cron-secret');
  if (
    process.env.SERVICE_CRON_SECRET?.trim() &&
    secret !== process.env.SERVICE_CRON_SECRET
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    await requireHotelModule('hotel_service');
  } catch {
    return NextResponse.json({ generated: 0, skipped: true, reason: 'module_inactive' });
  }
  const created = await runDueRecurringSchedules();
  return NextResponse.json({ generated: created.length, ids: created.map((c) => c.id) });
}
