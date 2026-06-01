import type { PrismaClient } from "../../../generated/client";
import bcrypt from "bcryptjs";

const DEFAULT_EMAILS = [
  "inaram84@gmail.com",
  "shirinov.chingiz@gmail.com",
  "chingiz@era.com",
] as const;

const DEFAULT_PASSWORD = "12345678";
const BCRYPT_ROUNDS = 10;

export type UpsertPlatformSuperAdminsMode = "preserve_password" | "reset_password";

/** Parse `PLATFORM_SUPER_ADMIN_EMAILS` (comma/semicolon/space separated). */
export function platformSuperAdminEmails(): readonly string[] {
  const raw = process.env.PLATFORM_SUPER_ADMIN_EMAILS?.trim();
  if (!raw) return DEFAULT_EMAILS;
  const parsed = [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];
  return parsed.length > 0 ? parsed : DEFAULT_EMAILS;
}

export function platformSuperAdminBootstrapPassword(): string {
  return (
    process.env.PLATFORM_SUPER_ADMIN_BOOTSTRAP_PASSWORD?.trim() ||
    DEFAULT_PASSWORD
  );
}

/** @deprecated use platformSuperAdminBootstrapPassword() */
export const PLATFORM_SUPER_ADMIN_DEFAULT_PASSWORD =
  platformSuperAdminBootstrapPassword();

/** @deprecated use platformSuperAdminEmails() */
export const PLATFORM_SUPER_ADMIN_EMAILS = platformSuperAdminEmails();

/**
 * Ensures platform super-admin users exist (Orchestrator canonical IdP).
 * - `preserve_password`: only ensure `isSuperAdmin` on update.
 * - `reset_password`: set bootstrap password on every upsert (dev/prod-init).
 */
export async function upsertPlatformSuperAdmins(
  prisma: PrismaClient,
  mode: UpsertPlatformSuperAdminsMode,
): Promise<void> {
  const password = platformSuperAdminBootstrapPassword();
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  for (const emailRaw of platformSuperAdminEmails()) {
    const email = emailRaw.toLowerCase().trim();
    await prisma.user.upsert({
      where: { email },
      create: {
        email,
        passwordHash: hash,
        isSuperAdmin: true,
      },
      update: {
        isSuperAdmin: true,
        ...(mode === "reset_password" ? { passwordHash: hash } : {}),
      },
    });
  }
}
