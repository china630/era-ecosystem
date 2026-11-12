/**
 * Inventory of hotel Next route handlers for the Nest cutover map.
 * Reads app/api/**\/route.ts and writes doc/nest-cutover-route-map.md.
 * Does not change runtime behavior.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const apiRoot = path.join(root, "app", "api");
const outFile = path.join(root, "doc", "nest-cutover-route-map.md");

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (entry.name === "route.ts") acc.push(full);
  }
  return acc;
}

function sliceBody(source, openBraceIndex) {
  let depth = 0;
  for (let i = openBraceIndex; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return source.slice(openBraceIndex + 1, i);
    }
  }
  return source.slice(openBraceIndex + 1);
}

function importedNames(source) {
  const services = new Set();
  const other = new Set();
  const re =
    /import\s+(type\s+)?\{([^}]+)\}\s+from\s+["']([^"']+)["']/g;
  let match;
  while ((match = re.exec(source))) {
    const target = match[2].includes("from") ? null : match[3];
    if (!target) continue;
    const names = match[2]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => part.replace(/^type\s+/, "").split(/\s+as\s+/).pop().trim());
    const bucket = target.includes("/services/") ? services : other;
    for (const name of names) {
      if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) bucket.add(name);
    }
  }
  return { services, other };
}

function called(body, names) {
  const hit = [];
  for (const name of names) {
    if (new RegExp(`\\b${name}\\s*\\(`).test(body)) hit.push(name);
  }
  return hit.sort();
}

function permissions(body) {
  return [...body.matchAll(/PERMISSIONS\.([A-Z0-9_]+)/g)].map((m) => m[1]);
}

function queryKeys(body) {
  const keys = [...body.matchAll(/\.get\(\s*["']([^"']+)["']\s*\)/g)].map((m) => m[1]);
  return [...new Set(keys)];
}

function schemaParses(body) {
  return [...new Set([...body.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\.parse(?:Async)?\s*\(/g)].map((m) => m[1]))];
}

function outputs(body) {
  const outs = [];
  for (const match of body.matchAll(/return\s+(jsonOk|jsonError|NextResponse\.json|handleRouteError)\s*\(/g)) {
    outs.push(match[1] === "NextResponse.json" ? "NextResponse.json" : match[1]);
  }
  if (/new NextResponse\(/.test(body)) outs.push("NextResponse(body)");
  if (/\.redirect\(/.test(body)) outs.push("redirect");
  return [...new Set(outs)];
}

function authKind(body, perms) {
  const bits = [];
  if (/getSatelliteSession\s*\(/.test(body)) bits.push("session");
  if (perms.length) bits.push(perms.join("|"));
  if (/assertAnyPermission\s*\(/.test(body)) bits.push("any-of");
  if (/requireService|serviceToken|SATELLITE_EVENT_SERVICE_TOKEN|assertInternal|internalAuth|Bearer/.test(body)) {
    bits.push("bearer-or-internal");
  }
  if (/cron|CRON_SECRET|x-cron/i.test(body) && !perms.length) bits.push("cron-secret?");
  if (!bits.length) bits.push("see-handler");
  return bits.join(" ");
}

function logicInRoute(body, serviceCalls) {
  const reasons = [];
  if (/\bprisma\./.test(body)) reasons.push("prisma");
  const awaits = [...body.matchAll(/await\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/g)].map((m) => m[1]);
  const allowed = new Set([
    ...serviceCalls,
    "getSatelliteSession",
    "assertPermission",
    "assertAnyPermission",
    "request",
    "jsonOk",
    "jsonError",
    "handleRouteError",
    "serialize",
    "params",
  ]);
  const local = awaits.filter((name) => !allowed.has(name) && !name.endsWith("Schema") && !name.endsWith("parse"));
  const uniqueLocal = [...new Set(local)].filter((name) => !serviceCalls.includes(name));
  if (uniqueLocal.length) reasons.push(`calls:${uniqueLocal.slice(0, 6).join(",")}`);
  const lines = body.split("\n").filter((line) => line.trim() && !line.trim().startsWith("//")).length;
  if (lines > 80 && reasons.length === 0) reasons.push(`long:${lines}`);
  return reasons.length ? reasons.join("; ") : "no";
}

function domainOf(urlPath) {
  const parts = urlPath.split("/").filter(Boolean);
  return parts[0] || "(root)";
}

const files = walk(apiRoot).sort();
const rows = [];
const unparsed = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const rel = path.relative(apiRoot, file).replaceAll("\\", "/").replace(/\/route\.ts$/, "");
  const urlPath = `/api/${rel}`;
  const { services, other } = importedNames(source);
  const re = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\([^)]*\)\s*\{/g;
  let match;
  let count = 0;
  while ((match = re.exec(source))) {
    count++;
    const body = sliceBody(source, match.index + match[0].length - 1);
    const perms = [...new Set(permissions(body))];
    const serviceCalls = called(body, services);
    const helperCalls = called(body, other).filter(
      (name) =>
        !["jsonOk", "jsonError", "handleRouteError", "serialize", "z", "NextResponse"].includes(name) &&
        !name.endsWith("Schema"),
    );
    const input = [];
    const q = queryKeys(body);
    if (q.length) input.push(`query:${q.join(",")}`);
    const schemas = schemaParses(body);
    if (schemas.length) input.push(`body:${schemas.join(",")}`);
    else if (/await\s+request\.json\s*\(/.test(body)) input.push("body:request.json");
    if (/formData\s*\(/.test(body)) input.push("body:formData");
    const params = [...rel.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
    if (params.length) input.push(`path:${params.join(",")}`);
    rows.push({
      domain: domainOf(rel),
      method: match[1],
      url: urlPath,
      auth: authKind(body, perms),
      input: input.join(" ") || "—",
      service: serviceCalls.length ? serviceCalls.join(", ") : helperCalls.slice(0, 4).join(", ") || "—",
      output: outputs(body).join(", ") || "—",
      logic: logicInRoute(body, serviceCalls),
    });
  }
  if (count === 0) unparsed.push(urlPath);
}

const domains = [...new Set(rows.map((row) => row.domain))].sort();
const lines = [];
lines.push("# Hotel API cutover map (Next route handlers)");
lines.push("");
lines.push("Generated inventory for the Nest move. Algorithms stay in services. This file records the HTTP edge only.");
lines.push("Regenerate: `node scripts/nest-cutover-route-map.mjs` from `era-hotel-pms`.");
lines.push("");
lines.push(`- Route files: ${files.length}`);
lines.push(`- Handlers: ${rows.length}`);
lines.push(
  "- Files that re-export handlers (not inlined in this hotel file, still edges): `GET`+`POST` `/api/internal/v1/organization/bind` (`createOrganizationBindHandlers`), `GET`+`POST` `/api/internal/v1/runtime-config` (`createRuntimeConfigHandlers` plus Elektraweb and fiscal hooks), `GET` `/api/platform/billing-status` (kit), `GET` `/api/reports/[slug]` (re-export of `layout/route`).",
);
if (unparsed.length) lines.push(`- Parser saw no inline verb on: ${unparsed.join(", ")}`);
lines.push(`- Handlers flagged with logic in the route (not only a service call): ${rows.filter((row) => row.logic !== "no").length}`);
lines.push("");
lines.push("Columns: method, URL, session/permission, input (query, body schema, path), called service (or helper if no service import), response helper, logic still inside the handler.");
lines.push("`logic = no` means the handler did not touch `prisma` and did not await a local function outside the known service imports. A long helper call list still needs a human look before that URL is moved.");
lines.push("");
lines.push("## Counts by first path segment");
lines.push("");
lines.push("| Segment | Handlers |");
lines.push("|---|---:|");
for (const domain of domains) {
  lines.push(`| ${domain} | ${rows.filter((row) => row.domain === domain).length} |`);
}
lines.push("");

function table(subset) {
  const out = [];
  out.push("| Method | URL | Auth | Input | Service | Output | Logic in route |");
  out.push("|---|---|---|---|---|---|---|");
  for (const row of subset) {
    const cell = (value) => String(value).replaceAll("|", "\\|");
    out.push(
      `| ${row.method} | \`${cell(row.url)}\` | ${cell(row.auth)} | ${cell(row.input)} | ${cell(row.service)} | ${cell(row.output)} | ${cell(row.logic)} |`,
    );
  }
  return out;
}

for (const domain of domains) {
  lines.push(`## ${domain}`);
  lines.push("");
  lines.push(...table(rows.filter((row) => row.domain === domain)));
  lines.push("");
}

fs.writeFileSync(outFile, lines.join("\n"), "utf8");
console.log(JSON.stringify({ files: files.length, handlers: rows.length, unparsed, outFile }, null, 2));
