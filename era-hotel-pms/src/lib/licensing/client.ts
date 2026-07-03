import axios from "axios";

export interface SeatCheckInput {
  organizationId: string;
  satelliteType: string;
  globalPersonId?: string;
  cpEmploymentId?: string;
}

export interface SeatCheckResult {
  allowed: boolean;
  tier?: string;
  seatsUsed?: number;
  seatsLimit?: number;
  message?: string;
  policy?: string;
}

export async function checkSeatQuota(input: SeatCheckInput): Promise<SeatCheckResult> {
  const orchUrl =
    process.env.ORCHESTRATOR_INTERNAL_URL ??
    process.env.ERA_CORE_LICENSING_URL;
  const token =
    process.env.ORCHESTRATOR_INTERNAL_SERVICE_TOKEN ??
    process.env.ERA_CORE_API_KEY;
  const limit = parseInt(process.env.LICENSING_SEAT_LIMIT ?? "10", 10);

  if (orchUrl && (input.globalPersonId || input.cpEmploymentId)) {
    try {
      const res = await axios.post(
        `${orchUrl.replace(/\/$/, "")}/internal/v1/licensing/seats/check`,
        {
          organizationId: input.organizationId,
          globalPersonId: input.globalPersonId,
          cpEmploymentId: input.cpEmploymentId,
        },
        {
          timeout: 8000,
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          validateStatus: () => true,
        },
      );

      if (res.status === 200) {
        return {
          allowed: res.data?.allowed !== false,
          tier: res.data?.tier,
          seatsUsed: res.data?.seatsUsed,
          seatsLimit: res.data?.seatsLimit,
          policy: res.data?.policy,
          message: res.data?.message,
        };
      }
    } catch (err) {
      console.error("CP licensing check failed, falling back to local count", err);
    }
  }

  const activeCount = await import("@/lib/prisma").then(({ prisma }) =>
    prisma.user.count({
      where: { status: "ACTIVE", isCrossSystem: false },
    }),
  );
  if (activeCount >= limit) {
    return {
      allowed: false,
      seatsUsed: activeCount,
      seatsLimit: limit,
      message: `Seat limit reached (${activeCount}/${limit}). Upgrade tier in ERA Workspace.`,
    };
  }
  return { allowed: true, seatsUsed: activeCount, seatsLimit: limit };
}
