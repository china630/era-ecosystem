/** YC-E adapter mode flags — fail-closed on live without credentials. */

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export type AdapterMode = "stub" | "sandbox" | "live";

function resolveMode(
  envKey: string,
  env: NodeJS.ProcessEnv = process.env,
): AdapterMode {
  const raw = (env[envKey] ?? "stub").toLowerCase();
  if (raw === "live" || raw === "sandbox" || raw === "stub") return raw;
  return "stub";
}

export function railMode(env: NodeJS.ProcessEnv = process.env): AdapterMode {
  return resolveMode("BANK_RAIL_MODE", env);
}

export function cardsMode(env: NodeJS.ProcessEnv = process.env): AdapterMode {
  return resolveMode("BANK_CARDS_MODE", env);
}

export function asanMode(env: NodeJS.ProcessEnv = process.env): AdapterMode {
  return resolveMode("BANK_ASAN_MODE", env);
}

export function akbMode(env: NodeJS.ProcessEnv = process.env): AdapterMode {
  const raw = (env.BANK_BUREAU_MODE ?? "stub").toLowerCase();
  if (raw === "live") return "live";
  if (raw === "sandbox") return "sandbox";
  return "stub";
}

export function cbarMode(env: NodeJS.ProcessEnv = process.env): AdapterMode {
  return resolveMode("BANK_CBAR_MODE", env);
}

export function assertLiveConfigured(
  mode: AdapterMode,
  creds: Record<string, string | undefined>,
  label: string,
): void {
  if (mode !== "live") return;
  const missing = Object.entries(creds)
    .filter(([, v]) => !v?.trim())
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new ConfigError(
      `${label}: live mode requires ${missing.join(", ")}`,
    );
  }
}

/** @deprecated Prefer railMode() from this module. */
export function resolveRailMode(
  env: NodeJS.ProcessEnv = process.env,
): AdapterMode {
  return railMode(env);
}
