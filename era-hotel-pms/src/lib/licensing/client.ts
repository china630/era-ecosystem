import axios from 'axios';

export interface SeatCheckInput {
  organizationId: string;
  satelliteType: string;
}

export interface SeatCheckResult {
  allowed: boolean;
  tier?: string;
  seatsUsed?: number;
  seatsLimit?: number;
  message?: string;
}

export async function checkSeatQuota(input: SeatCheckInput): Promise<SeatCheckResult> {
  const url = process.env.ERA_CORE_LICENSING_URL;
  const limit = parseInt(process.env.LICENSING_SEAT_LIMIT ?? '10', 10);

  if (!url) {
    const activeCount = await import('@/lib/prisma').then(({ prisma }) =>
      prisma.user.count({
        where: { status: 'ACTIVE', isCrossSystem: false },
      }),
    );
    if (activeCount >= limit) {
      return {
        allowed: false,
        seatsUsed: activeCount,
        seatsLimit: limit,
        message: `Seat limit reached (${activeCount}/${limit}). Upgrade tier in ERA Finance.`,
      };
    }
    return { allowed: true, seatsUsed: activeCount, seatsLimit: limit };
  }

  try {
    const res = await axios.post(
      url,
      {
        organizationId: input.organizationId,
        satelliteType: input.satelliteType,
      },
      {
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json',
          ...(process.env.ERA_CORE_API_KEY
            ? { Authorization: `Bearer ${process.env.ERA_CORE_API_KEY}` }
            : {}),
        },
        validateStatus: () => true,
      },
    );

    if (res.status === 200 && res.data?.allowed !== false) {
      return {
        allowed: true,
        tier: res.data?.tier,
        seatsUsed: res.data?.seatsUsed,
        seatsLimit: res.data?.seatsLimit,
      };
    }

    return {
      allowed: false,
      tier: res.data?.tier,
      seatsUsed: res.data?.seatsUsed,
      seatsLimit: res.data?.seatsLimit,
      message:
        res.data?.message ??
        'Quota exceeded for your subscription tier. Upgrade in ERA Finance.',
    };
  } catch (err) {
    console.error('Licensing check failed, allowing in dev fallback', err);
    return { allowed: true, message: 'Licensing service unavailable (dev fallback)' };
  }
}
