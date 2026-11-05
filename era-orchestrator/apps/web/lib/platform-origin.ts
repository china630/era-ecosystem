/** Vendor console origin (platform-web). Override via NEXT_PUBLIC_ERA_PLATFORM_ORIGIN. */
export function platformConsoleOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_ERA_PLATFORM_ORIGIN?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "app.era-365.online" || host.endsWith(".era-365.online")) {
      return "https://platform.era-365.online";
    }
  }
  return "http://127.0.0.1:3001";
}

/** Map legacy /super-admin/* paths to platform-web short paths. */
export function platformPathFromSuperAdmin(pathname: string): string {
  const raw = pathname.startsWith("/super-admin")
    ? pathname.slice("/super-admin".length) || "/"
    : pathname;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

export function platformConsoleUrl(pathname = "/"): string {
  const path = platformPathFromSuperAdmin(pathname);
  return `${platformConsoleOrigin()}${path}`;
}
