import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { prisma } from '@/lib/prisma';
import { getSatelliteSession } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import {
  closeOpenCashShift,
  openCashShiftExplicit,
} from '@/lib/services/cash-shift.service';

const openSchema = z.object({
  cashier: z.string().min(1),
  registerId: z.string().min(1),
  isPrimary: z.boolean().optional(),
  fiscalDeviceId: z.string().min(1).max(64).optional(),
  bankTerminalId: z.string().min(1).max(64).optional(),
});

export async function GET() {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.CASH_SHIFT);
    const shifts = await prisma.cashShift.findMany({ orderBy: { openedAt: 'desc' }, take: 20 });
    return jsonOk(serialize(shifts));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    assertPermission(session, PERMISSIONS.CASH_SHIFT);
    const url = new URL(request.url);
    const action = url.searchParams.get('action');
    if (action === 'close') {
      const closed = await closeOpenCashShift({
        userId: session?.sub,
        request,
      });
      return jsonOk(serialize(closed));
    }
    const body = openSchema.parse(await request.json());
    const shift = await openCashShiftExplicit({
      ...body,
      audit: { userId: session?.sub, request },
    });
    return jsonOk(serialize(shift), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
