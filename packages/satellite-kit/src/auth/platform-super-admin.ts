const DEFAULT_EMAILS = [
  "inaram84@gmail.com",
  "shirinov.chingiz@gmail.com",
  "chingiz@era.com",
] as const;

const DEFAULT_PASSWORD = "12345678";

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

/** Bootstrap / seed password for platform super-admins (local satellite login). */
export function platformSuperAdminBootstrapPassword(): string {
  return (
    process.env.PLATFORM_SUPER_ADMIN_BOOTSTRAP_PASSWORD?.trim() ||
    process.env.ECOSYSTEM_DEMO_PASSWORD?.trim() ||
    DEFAULT_PASSWORD
  );
}

export function isPlatformSuperAdminUser(user: {
  email?: string | null;
  login: string;
}): boolean {
  const allowed = platformSuperAdminEmails();
  const email = user.email?.trim().toLowerCase();
  if (email && allowed.includes(email)) return true;
  const login = user.login.trim().toLowerCase();
  return allowed.includes(login);
}
