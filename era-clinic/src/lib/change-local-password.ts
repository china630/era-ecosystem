import { hashPassword, verifyPassword } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export const LOCAL_PASSWORD_MIN_LENGTH = 8;

export class LocalPasswordError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "LocalPasswordError";
    this.status = status;
  }
}

export async function changeLocalPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const current = input.currentPassword;
  const next = input.newPassword;
  if (next.trim().length < LOCAL_PASSWORD_MIN_LENGTH) {
    throw new LocalPasswordError(
      `New password must be at least ${LOCAL_PASSWORD_MIN_LENGTH} characters`,
      400,
    );
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.status !== "ACTIVE") {
    throw new LocalPasswordError("Unauthorized", 401);
  }
  if (user.passwordHash === "sso:no-password") {
    throw new LocalPasswordError("SSO accounts have no local password", 403);
  }
  const ok = await verifyPassword(current, user.passwordHash);
  if (!ok) {
    throw new LocalPasswordError("Current password is incorrect", 401);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
}
