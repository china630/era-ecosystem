import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';

const openSchema = z.object({
  cashier: z.string().min(1),
  registerId: z.string().min(1),
  isPrimary: z.boolean().optional(),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function GET() {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CASH_SHIFT);
    const shifts = await prisma.cashShift.findMany({ orderBy: { openedAt: 'desc' }, take: 20 });
    return jsonOk(serialize(shifts));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.CASH_SHIFT);
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if (action === 'close') {
      const open = await prisma.cashShift.findFirst({ where: { status: 'OPEN' } });
      if (!open) throw new Error('No open cash shift');
      const closed = await prisma.cashShift.update({
        where: { id: open.id },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      return jsonOk(serialize(closed));
    }
    const body = openSchema.parse(await request.json());
    const existing = await prisma.cashShift.findFirst({ where: { status: 'OPEN' } });
    if (existing) throw new Error('A cash shift is already open');
    const hasPrimary = await prisma.cashShift.findFirst({
      where: { status: 'OPEN', isPrimary: true },
    });
    const isPrimary = body.isPrimary ?? !hasPrimary;
    const { resolveDefaultDevicesForSatellite, assertLiveFiscalReady } =
      await import('@era/satellite-kit');
    const { requestOrganizationId } = await import('@/lib/request-organization');
    const organizationId = requestOrganizationId();
    if (process.env.ERA_FISCAL_LIVE === 'true') {
      assertLiveFiscalReady({ organizationId, registerRef: body.registerId });
    }
    const defaults = resolveDefaultDevicesForSatellite({
      organizationId,
      registerRef: body.registerId,
    });
    const shift = await prisma.cashShift.create({
      data: {
        cashier: body.cashier,
        registerId: body.registerId,
        isPrimary,
        status: 'OPEN',
        fiscalDeviceId: body.fiscalDeviceId ?? defaults.fiscalDeviceId ?? null,
        bankTerminalId: body.bankTerminalId ?? defaults.bankTerminalId ?? null,
      },
    });
    return jsonOk(serialize(shift), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
