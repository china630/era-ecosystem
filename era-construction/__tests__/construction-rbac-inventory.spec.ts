import fs from "fs";
import path from "path";
import {
  API_ROUTE_RULES,
  AUTH_ONLY_API_ROUTES,
  HANDLER_GATE_EXCEPTIONS,
  PUBLIC_API_ROUTES,
  apiRoutePermissions,
} from "@/lib/auth/api-route-permissions";
import {
  AUTH_ONLY_PAGES,
  PAGE_ROUTE_RULES,
  isPublicStaffPage,
  routePermissions,
} from "@/lib/auth/page-route-permissions";
import { matchRoutePattern, matchesAnyRoute } from "@/lib/auth/route-match";

const ROOT = path.join(__dirname, "..");
const APP = path.join(ROOT, "app");
const NEST_CONTROLLERS = path.join(ROOT, "nest", "native", "controllers");

function walk(dir: string, fileName: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, fileName, out);
    else if (entry.name === fileName) out.push(full);
  }
  return out;
}

/** `app/a/[id]/b/page.tsx` → `/a/x1/b`; route groups drop out. */
function samplePath(file: string, base: string): string {
  const rel = path.relative(base, path.dirname(file)).split(path.sep).filter(Boolean);
  const segs = rel
    .filter((s) => !(s.startsWith("(") && s.endsWith(")")))
    .map((s) => (s.startsWith("[") ? "x1" : s));
  return `/${segs.join("/")}`;
}

/** Expand catalog patterns to concrete sample paths for inventory checks. */
function sampleFromPattern(pattern: string): string {
  return pattern.replace(/\*\*/g, "x").replace(/\*/g, "x1");
}

const pageFiles = walk(APP, "page.tsx").filter(
  (f) => !path.relative(APP, f).split(path.sep).includes("api"),
);
const pagePaths = pageFiles.map((f) => samplePath(f, APP));

const apiPaths = [
  ...PUBLIC_API_ROUTES.map(sampleFromPattern),
  ...AUTH_ONLY_API_ROUTES.map(sampleFromPattern),
  ...HANDLER_GATE_EXCEPTIONS.map(sampleFromPattern),
  ...API_ROUTE_RULES.map(([pattern]) => sampleFromPattern(pattern)),
  "/api/integration/staff-provision",
];

const controllerFiles = fs.existsSync(NEST_CONTROLLERS)
  ? fs
      .readdirSync(NEST_CONTROLLERS)
      .filter((n) => n.endsWith(".controller.ts"))
      .map((n) => path.join(NEST_CONTROLLERS, n))
  : [];

describe("page inventory", () => {
  it.each(pagePaths)("%s is public, session-only, or mapped to a grant", (p) => {
    expect(isPublicStaffPage(p) || routePermissions(p) !== null).toBe(true);
  });

  it("every page rule and session-only page matches a real page", () => {
    for (const [pattern] of PAGE_ROUTE_RULES) {
      expect({ pattern, hit: pagePaths.some((p) => matchRoutePattern(pattern, p)) }).toEqual({
        pattern,
        hit: true,
      });
    }
    for (const pattern of AUTH_ONLY_PAGES) {
      expect({ pattern, hit: pagePaths.some((p) => matchRoutePattern(pattern, p)) }).toEqual({
        pattern,
        hit: true,
      });
    }
  });
});

describe("API inventory", () => {
  it.each(apiPaths)("%s is public, a declared handler exception, session-only, or mapped to a grant", (p) => {
    expect(
      matchesAnyRoute(PUBLIC_API_ROUTES, p) ||
        matchesAnyRoute(HANDLER_GATE_EXCEPTIONS, p) ||
        apiRoutePermissions(p) !== null ||
        p.startsWith("/api/integration/"),
    ).toBe(true);
  });

  it("every API rule and handler exception matches a catalog sample path", () => {
    for (const pattern of [...API_ROUTE_RULES.map(([p]) => p), ...HANDLER_GATE_EXCEPTIONS]) {
      expect({
        pattern,
        hit: apiPaths.some((p) => matchRoutePattern(pattern, p)),
      }).toEqual({
        pattern,
        hit: true,
      });
    }
  });

  it("Nest Controllers exist and staff Controllers use ConstructionStaffGuard or public surface", () => {
    expect(controllerFiles.length).toBeGreaterThan(10);
    const staffControllers = controllerFiles.filter(
      (f) =>
        !/(health|locale|events|internal|integration|auth)\.controller\.ts$/.test(path.basename(f)),
    );
    for (const file of staffControllers) {
      const src = fs.readFileSync(file, "utf8");
      expect({
        file: path.basename(file),
        hasGuard: /ConstructionStaffGuard/.test(src),
      }).toEqual({
        file: path.basename(file),
        hasGuard: true,
      });
    }
  });

  it("middleware public API prefixes are declared in PUBLIC_API_ROUTES", () => {
    const src = fs.readFileSync(path.join(ROOT, "middleware.ts"), "utf8");
    const block = /publicApiPrefixes:\s*\[([\s\S]*?)\]/.exec(src)?.[1] ?? "";
    const prefixes = [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    for (const prefix of prefixes) {
      expect(matchesAnyRoute(PUBLIC_API_ROUTES, prefix)).toBe(true);
    }
  });
});
