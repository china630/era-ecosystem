import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runCronForEachTenant } from '@era/satellite-kit';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { listCronOrganizationIdsFromDb, fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";
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

/**
 * Cron hook: generate work orders for due schedules (multi-org via ERA_CRON_ORGANIZATION_IDS).
 * Auth: Authorization Bearer SERVICE_CRON_SECRET, or legacy x-service-cron-secret = raw secret.
 */
export async function PUT(req: Request) {
  const legacy = req.headers.get('x-service-cron-secret');
  const authorization =
    req.headers.get('authorization') ??
    (legacy ? `Bearer ${legacy}` : null);

  const gate = await runCronForEachTenant(
    {
      satelliteKey: 'industry_hotel_pms',
      moduleKey: 'hotel_service',
      authorization,
      cronSecretEnv: 'SERVICE_CRON_SECRET',
      listOrganizationIds: listCronOrganizationIdsFromDb,
        fetchPoolOrganizationIds: fetchHotelPoolOrganizationIds,
    },
    async (organizationId) => {
      const created = await runDueRecurringSchedules();
      return {
        organizationId,
        generated: created.length,
        ids: created.map((c) => c.id),
      };
    },
  );

  if (!gate.ok) {
    if (gate.status === 401) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (gate.status === 503) {
      return NextResponse.json({ error: 'satellite_unbound' }, { status: 503 });
    }
    return NextResponse.json({
      generated: 0,
      skipped: true,
      reason: gate.reason,
      moduleKey: gate.moduleKey,
    });
  }

  return NextResponse.json({ byOrganization: gate.results });
}
