import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runCronForEachTenant } from '@era/satellite-kit';
import { handleRouteError, jsonError } from '@/lib/api-utils';
import { getSatelliteSession } from '@/lib/auth/session';
import { requireHotelModule } from '@/lib/hotel-module-gate';
import { fetchHotelPoolOrganizationIds } from "@/lib/cron-organization-ids";
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
  try {
    const session = await getSatelliteSession();
    if (!session) return jsonError('Unauthorized', 401);
    await requireHotelModule('hotel_service', session.organizationId);
    const rows = await prisma.recurringServiceSchedule.findMany({
      orderBy: { nextDueAt: 'asc' },
      take: 100,
    });
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
    const row = await prisma.recurringServiceSchedule.create({
      data: {
        organizationId: session.organizationId,
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
  } catch (err) {
    return handleRouteError(err);
  }
}

/**
 * Cron hook: generate work orders for due schedules (multi-org via orch pool registry).
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
      return NextResponse.json({ error: gate.reason }, { status: 503 });
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
