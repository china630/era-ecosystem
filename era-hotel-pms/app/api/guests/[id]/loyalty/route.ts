import { z } from 'zod';
import { jsonOk, handleRouteError } from '@/lib/api-utils';
import { serialize } from '@/lib/serialize';
import { getSessionFromHeaders } from '@/lib/auth/session';
import { assertPermission } from '@/lib/auth/require';
import { PERMISSIONS } from '@/lib/auth/permissions';
import { listGuestLoyaltyCards } from '@/lib/services/guest-aux.service';
import { prisma } from '@/lib/prisma';

const patchSchema = z.object({ loyaltyTier: z.string().optional() });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_READ);
    const { id } = await params;
    const guest = await prisma.guest.findUnique({ where: { id }, select: { loyaltyTier: true } });
    const cards = await listGuestLoyaltyCards(id);
    return jsonOk(serialize({ loyaltyTier: guest?.loyaltyTier ?? null, cards }));
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getSessionFromHeaders();
    assertPermission(session, PERMISSIONS.RESERVATIONS_WRITE);
    const { id } = await params;
    const body = patchSchema.parse(await request.json());
    const tier = body.loyaltyTier ?? 'STANDARD';
    const guest = await prisma.guest.update({
      where: { id },
      data: { loyaltyTier: tier },
    });
    return jsonOk(serialize({ guest, loyaltyTier: tier }));
  } catch (err) {
    return handleRouteError(err);
  }
}
