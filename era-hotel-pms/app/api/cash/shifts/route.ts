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
    const shift = await prisma.cashShift.create({ data: { ...body, status: 'OPEN' } });
    return jsonOk(serialize(shift), 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
