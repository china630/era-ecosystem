import { verifyPassword } from "./password";

export type SatelliteUserRecord = {
  id: string;
  login: string;
  email: string | null;
  phone: string | null;
  fullName: string;
  passwordHash: string;
  status: string;
  role: { code: string };
};

type UserFindArgs = {
  where: {
    OR: Array<
      | { login: string }
      | { email: string }
      | { phone: string }
    >;
  };
  include: { role: true };
};

/** Resolve user by login, email, or phone (exact match, trimmed). */
export async function findUserByCredential(
  prisma: unknown,
  credential: string,
): Promise<SatelliteUserRecord | null> {
  const id = credential.trim();
  if (!id) return null;
  const db = prisma as {
    user: { findFirst(args: UserFindArgs): Promise<unknown> };
  };
  const row = await db.user.findFirst({
    where: {
      OR: [{ login: id }, { email: id }, { phone: id }],
    },
    include: { role: true },
  });
  return (row ?? null) as SatelliteUserRecord | null;
}

export async function verifySatelliteUserPassword(
  password: string,
  user: Pick<SatelliteUserRecord, "passwordHash">,
): Promise<boolean> {
  return verifyPassword(password, user.passwordHash);
}

export function isSatelliteUserLoginAllowed(
  user: Pick<SatelliteUserRecord, "passwordHash" | "status">,
): boolean {
  if (user.status !== "ACTIVE") return false;
  if (user.passwordHash === "sso:no-password") return false;
  return true;
}
