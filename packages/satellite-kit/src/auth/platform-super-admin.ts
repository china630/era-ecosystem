const DEFAULT_EMAILS = [
  "inaram84@gmail.com",
  "shirinov.chingiz@gmail.com",
  "chingiz@era.com",
] as const;

const DEFAULT_PASSWORD = "12345678";

/** Parse `PLATFORM_SUPER_ADMIN_EMAILS` (comma/semicolon/space separated). */
export function platformSuperAdminEmails(): readonly string[] {
  const raw = process.env.PLATFORM_SUPER_ADMIN_EMAILS?.trim();
  if (!raw) {
    // SEC-SSO-04: never ship production with baked-in PSA allowlist
    if (process.env.NODE_ENV === "production") return [];
    return DEFAULT_EMAILS;
  }
  const parsed = [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];
  if (parsed.length > 0) return parsed;
  if (process.env.NODE_ENV === "production") return [];
  return DEFAULT_EMAILS;
}

/** Bootstrap / seed password for platform super-admins (local satellite login). */
export function platformSuperAdminBootstrapPassword(): string {
  const fromEnv =
    process.env.PLATFORM_SUPER_ADMIN_BOOTSTRAP_PASSWORD?.trim() ||
    process.env.ECOSYSTEM_DEMO_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  // SEC-SSO-04: no default password in production
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PLATFORM_SUPER_ADMIN_BOOTSTRAP_PASSWORD (or ECOSYSTEM_DEMO_PASSWORD) required in production",
    );
  }
  return DEFAULT_PASSWORD;
}

export function isPlatformSuperAdminUser(user: {
  email?: string | null;
  login: string;
}): boolean {
  const allowed = platformSuperAdminEmails();
  if (allowed.length === 0) return false;
  const email = user.email?.trim().toLowerCase();
  if (email && allowed.includes(email)) return true;
  const login = user.login.trim().toLowerCase();
  return allowed.includes(login);
}
