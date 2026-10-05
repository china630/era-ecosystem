import { bakuDayBounds } from "@era/satellite-kit/time";
import { prisma } from "@/lib/prisma";

function clientIp(request: Request): string | null {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return request.headers.get("x-real-ip");
}

/** Best-effort. Sign-in continues when the journal table is not migrated yet. */
export async function recordUserLogin(
  user: { id: string; organizationId: string; login: string },
  request: Request,
): Promise<void> {
  try {
    await prisma.userLogin.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        login: user.login,
        ipAddress: clientIp(request),
        userAgent: request.headers.get("user-agent"),
      },
    });
  } catch {
    // Sign-in continues when the login journal is not migrated yet.
  }
}

export async function listUserLogins(opts: {
  organizationId: string;
  q?: string;
  from?: string;
  to?: string;
  limit?: number;
}) {
  let from = opts.from?.trim();
  let to = opts.to?.trim();
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }
  const createdAt: { gte?: Date; lt?: Date } = {};
  if (from) createdAt.gte = bakuDayBounds(from).start;
  if (to) createdAt.lt = bakuDayBounds(to).end;
  const q = opts.q?.trim();
  const rows = await prisma.userLogin.findMany({
    where: {
      organizationId: opts.organizationId,
      ...(createdAt.gte || createdAt.lt ? { createdAt } : {}),
      ...(q
        ? {
            OR: [
              { login: { contains: q, mode: "insensitive" } },
              { user: { fullName: { contains: q, mode: "insensitive" } } },
              { ipAddress: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    take: opts.limit ?? 200,
    include: { user: { select: { fullName: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    login: row.login,
    fullName: row.user.fullName,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
  }));
}
