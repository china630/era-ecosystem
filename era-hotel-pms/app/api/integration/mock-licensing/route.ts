import { jsonOk } from '@/lib/api-utils';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const organizationId = String(body.organizationId ?? 'unknown');
  const limit = parseInt(process.env.LICENSING_SEAT_LIMIT ?? '10', 10);

  const seatsUsed = await prisma.user.count({
    where: { status: 'ACTIVE', isCrossSystem: false },
  });

  const allowed = seatsUsed < limit;

  return jsonOk({
    allowed,
    organizationId,
    satelliteType: body.satelliteType ?? 'hotel_pms',
    tier: 'Tier1',
    seatsUsed,
    seatsLimit: limit,
    message: allowed
      ? undefined
      : `Quota exceeded (${seatsUsed}/${limit}). Upgrade tier in ERA Finance.`,
  }, allowed ? 200 : 403);
}
