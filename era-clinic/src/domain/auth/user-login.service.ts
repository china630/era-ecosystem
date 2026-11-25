import { bakuDayBounds } from "@era/satellite-kit/time";
import { prisma } from "@/lib/prisma";

export async function findUserIdByLoginAndOrg(login: string, organizationId: string) {
  return prisma.user.findFirst({
    where: { login, organizationId },
    select: { id: true },
  });
}

type HeaderSource =
  | { get(name: string): string | null }
  | { headers: { get(name: string): string | null } };

function readHeader(source: HeaderSource, name: string): string | null {
  if ("headers" in source) return source.headers.get(name);
  return source.get(name);
}

function clientIp(request: HeaderSource): string | null {
  const fwd = readHeader(request, "x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || null;
  return readHeader(request, "x-real-ip");
}

/** Best-effort. Sign-in continues when the journal table is not migrated yet. */
export async function recordUserLogin(
  user: { id: string; organizationId: string; login: string },
  request: HeaderSource,
): Promise<void> {
  try {
    await prisma.userLogin.create({
      data: {
        organizationId: user.organizationId,
        userId: user.id,
        login: user.login,
        ipAddress: clientIp(request),
        userAgent: readHeader(request, "user-agent"),
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
