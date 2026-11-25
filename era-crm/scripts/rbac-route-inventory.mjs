/**
 * T-I04: inventory Nest/generated + app API routes vs permission catalog hints.
 * Usage: node scripts/rbac-route-inventory.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const generated = path.join(root, "nest", "generated");
const appApi = path.join(root, "app", "api");
const permFile = path.join(root, "src", "lib", "auth", "api-route-permissions.ts");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx|js)$/.test(name)) acc.push(p);
  }
  return acc;
}

const routes = new Set();
const routeRe =
  /http\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;

for (const file of walk(generated)) {
  const text = fs.readFileSync(file, "utf8");
  let m;
  while ((m = routeRe.exec(text))) routes.add(`${m[1].toUpperCase()} ${m[2]}`);
}

const nestRoutes = path.join(root, "nest", "integrations-routes.ts");
if (fs.existsSync(nestRoutes)) {
  const text = fs.readFileSync(nestRoutes, "utf8");
  let m;
  while ((m = routeRe.exec(text))) routes.add(`${m[1].toUpperCase()} ${m[2]}`);
}

for (const file of walk(appApi)) {
  const rel = path.relative(appApi, file).replace(/\\/g, "/");
  if (!rel.endsWith("route.ts") && !rel.endsWith("route.js")) continue;
  const apiPath =
    "/api/" +
    rel
      .replace(/\/route\.tsx?$/, "")
      .replace(/\/route\.js$/, "")
      .replace(/\[([^\]]+)\]/g, ":$1");
  routes.add(`* ${apiPath}`);
}

const permText = fs.existsSync(permFile)
  ? fs.readFileSync(permFile, "utf8")
  : "";
const listed = [...routes].sort();
const missingHint = listed.filter((r) => {
  const p = r.split(" ").slice(1).join(" ");
  return p.startsWith("/api/") && !permText.includes(p.split("/:")[0]);
});

console.log(`RBAC route inventory: ${listed.length} routes`);
console.log(`Permission file hints missing (heuristic): ${missingHint.length}`);
for (const r of missingHint.slice(0, 40)) console.log(`  ? ${r}`);
if (missingHint.length > 40) console.log(`  … +${missingHint.length - 40} more`);
process.exit(0);
