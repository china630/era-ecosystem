import { prisma } from "@/lib/prisma";

/** Linked Practitioner for the signed-in clinic user, if any. */
export async function resolveSessionPractitionerId(
  userId: string,
): Promise<string | null> {
  const row = await prisma.practitioner.findFirst({
    where: { userId, active: true },
    select: { id: true },
  });
  return row?.id ?? null;
}
