function readPublicEnv(name: string): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env[name];
}

/** Orchestrator web origin for public links (register, pricing, FAQ, terms). */
export function orchWebUrl(): string {
  const raw =
    readPublicEnv("NEXT_PUBLIC_ORCH_WEB_URL") ??
    readPublicEnv("NEXT_PUBLIC_ERA_APP_ORIGIN") ??
    "http://127.0.0.1:3000";
  return raw.replace(/\/$/, "");
}

export function orchPublicHref(path: string): string {
  const base = orchWebUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}
