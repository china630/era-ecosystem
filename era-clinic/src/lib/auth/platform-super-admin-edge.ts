/**
 * Edge-safe platform super-admin allowlist — must not import `@era/satellite-kit`
 * (Node crypto). Keep in sync with `packages/satellite-kit/src/auth/platform-super-admin.ts`.
 */

const DEFAULT_PLATFORM_SUPER_ADMIN_EMAILS = [
  "inaram84@gmail.com",
  "shirinov.chingiz@gmail.com",
  "chingiz@era.com",
] as const;

export function isPlatformSuperAdminEdge(user: {
  email?: string | null;
  login: string;
}): boolean {
  const raw = process.env.PLATFORM_SUPER_ADMIN_EMAILS?.trim();
  const allowed = raw
    ? [
        ...new Set(
          raw
            .split(/[,;\s]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.includes("@")),
        ),
      ]
    : [...DEFAULT_PLATFORM_SUPER_ADMIN_EMAILS];
  const list = allowed.length > 0 ? allowed : [...DEFAULT_PLATFORM_SUPER_ADMIN_EMAILS];
  const email = user.email?.trim().toLowerCase();
  if (email && list.includes(email)) return true;
  return list.includes(user.login.trim().toLowerCase());
}
