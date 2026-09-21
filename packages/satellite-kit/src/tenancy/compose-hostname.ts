/**
 * Compose service hostnames that only resolve inside the Docker network.
 * Host `npm run dev` must use 127.0.0.1 + published ports instead.
 */
const COMPOSE_HOSTNAME_PORTS: Record<string, string> = {
  orchestrator: "4000",
  "finance-core": "4100",
  "finance-web": "3100",
  "data-hub": "4200",
  postgres: "5432",
  redis: "6379",
};

/**
 * Probe `/.dockerenv` without a static `node:fs` / `node:fs` import so Next.js
 * client bundles (orchestrator web → satellite-kit UI hooks) can compile.
 */
function dockerEnvFilePresent(): boolean {
  if (typeof window !== "undefined") return false;
  try {
    const req = Function(
      "return typeof require !== 'undefined' ? require : undefined",
    )() as NodeRequire | undefined;
    if (!req) return false;
    return Boolean(req("fs").existsSync("/.dockerenv"));
  } catch {
    return false;
  }
}

/**
 * `ERA_IN_DOCKER=1` / `0` overrides detection. Default: `/.dockerenv` present
 * (Node servers only; browsers always treat as host).
 */
export function isRunningInsideDocker(): boolean {
  const flag = process.env.ERA_IN_DOCKER?.trim();
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  return dockerEnvFilePresent();
}

/**
 * Rewrite Sync-pushed `http://orchestrator:4000` (and siblings) to loopback
 * when the process is not in Compose. No-op inside Docker.
 */
export function rewriteComposeHostnameForHost(url: string): string {
  const trimmed = url.trim().replace(/\/$/, "");
  if (!trimmed) return trimmed;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed;
  }
  const mappedPort = COMPOSE_HOSTNAME_PORTS[parsed.hostname];
  if (!mappedPort) return trimmed;
  if (isRunningInsideDocker()) return trimmed;
  parsed.hostname = "127.0.0.1";
  if (!parsed.port) parsed.port = mappedPort;
  return parsed.origin.replace(/\/$/, "");
}
