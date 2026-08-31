import { hashPassword, verifyPassword } from "@era/satellite-kit";
import { prisma } from "@/lib/prisma";

export class PasswordChangeError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PasswordChangeError";
    this.status = status;
  }
}

const MIN_PASSWORD = 8;

export async function changeLocalPassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  const next = input.newPassword.trim();
  if (next.length < MIN_PASSWORD) {
    throw new PasswordChangeError(
      `Password must be at least ${MIN_PASSWORD} characters`,
      400,
    );
  }
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (!user || user.status !== "ACTIVE") {
    throw new PasswordChangeError("Unauthorized", 401);
  }
  if (user.passwordHash === "sso:no-password") {
    throw new PasswordChangeError(
      "SSO accounts have no local password",
      400,
    );
  }
  const ok = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw new PasswordChangeError("Current password is incorrect", 400);
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(next) },
  });
}
