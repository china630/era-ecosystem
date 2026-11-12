export type TranslatedHandler = {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** False when the body has a file upload. The calls are still listed. */
  ready: boolean;
  blockedBy: string[];
  kept: string[];
  nestMethod: string;
};

const HANDLER =
  /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/g;

function bodyOf(source: string, openBrace: number): string {
  let depth = 1;
  let i = openBrace + 1;
  while (i < source.length && depth > 0) {
    const ch = source[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return source.slice(openBrace + 1, i - 1);
}

function keptCalls(body: string): { kept: string[]; blockedBy: string[] } {
  const kept: string[] = [];
  const blockedBy: string[] = [];
  const permission = body.match(/assertPermission\s*\([^)]*\)/);
  if (permission) kept.push(permission[0].replace(/\s+/g, " "));
  const schema = body.match(/[A-Za-z_][A-Za-z0-9_]*Schema\.parse\s*\(/);
  if (schema) kept.push(schema[0].replace(/\s+/g, ""));
  const form = body.match(/formData\s*\(\s*\)/);
  if (form) {
    kept.push("formData()");
    blockedBy.push("formData");
  }
  const event = body.match(/dispatchSatelliteEvent\s*\(/);
  if (event) kept.push("dispatchSatelliteEvent(");
  const service = body.match(/await\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g) ?? [];
  for (const call of service) {
    const name = call.replace(/await\s+/, "").replace(/\s*\($/, "");
    if (name === "request") continue;
    kept.push(`await ${name}(`);
  }
  return { kept, blockedBy };
}

/**
 * Pulls the calls a Nest method must keep from a thin Next route.
 * File uploads stay listed and are not marked ready.
 */
export function translateNextRouteModule(source: string): TranslatedHandler[] {
  const handlers: TranslatedHandler[] = [];
  for (const match of source.matchAll(HANDLER)) {
    const method = match[1] as TranslatedHandler["method"];
    const open = (match.index ?? 0) + match[0].length - 1;
    const { kept, blockedBy } = keptCalls(bodyOf(source, open));
    const lines = kept.map((call) => `    ${call.includes("(") ? call : `${call}()`}`);
    handlers.push({
      method,
      ready: blockedBy.length === 0 && kept.length > 0,
      blockedBy,
      kept,
      nestMethod: [`async ${method.toLowerCase()}() {`, ...lines, "  }"].join("\n"),
    });
  }
  return handlers;
}
