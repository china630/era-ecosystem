import { prisma } from "@/lib/prisma";

/** Name of the person who entered the blank. Not the stay's attending doctor. */
export async function performerNameForUserIds(
  userIds: Array<string | null | undefined>,
): Promise<string | null> {
  const ids = [...new Set(userIds.filter((value): value is string => Boolean(value && value.trim())))];
  if (ids.length === 0) return null;
  const people = await prisma.practitioner.findMany({
    where: { userId: { in: ids }, active: true },
    select: { userId: true, fullName: true },
  });
  const byUser = new Map(people.map((row) => [row.userId, row.fullName?.trim() || ""]));
  for (const id of ids) {
    const name = byUser.get(id);
    if (name) return name;
  }
  return null;
}
