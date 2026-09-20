import fs from "node:fs";
import path from "node:path";
import {
  isPublicStaffPage,
  routePermissions,
} from "@/lib/auth/page-route-permissions";
import { PERMISSIONS } from "@/lib/auth/permissions";

function walkPages(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkPages(p, out);
    else if (ent.name === "page.tsx") out.push(p);
  }
  return out;
}

/** Convert app/foo/[id]/page.tsx → /foo/x (dynamic segments collapsed). */
function pageToPathname(appRoot: string, file: string): string {
  const dir = path.dirname(file);
  let rel = path.relative(appRoot, dir).replace(/\\/g, "/");
  if (!rel || rel === ".") return "/";
  rel = rel.replace(/\[[^\]]+\]/g, "x");
  return `/${rel}`;
}

describe("hotel page route inventory (Wave 1 fail-closed)", () => {
  it("every app/**/page.tsx is public, agency, or mapped by routePermissions", () => {
    const appRoot = path.join(__dirname, "..", "app");
    const missing: string[] = [];
    for (const file of walkPages(appRoot)) {
      const pathname = pageToPathname(appRoot, file);
      if (isPublicStaffPage(pathname)) continue;
      if (pathname === "/agency" || pathname.startsWith("/agency/")) continue;
      if (routePermissions(pathname) == null) {
        missing.push(pathname);
      }
    }
    expect(missing).toEqual([]);
  });

  it("settings/import requires import screen, not master_data alone", () => {
    expect(routePermissions("/settings/import")).toEqual([
      PERMISSIONS.SCREEN_SETTINGS_IMPORT,
    ]);
  });

  it("spa and tours are gated by screens", () => {
    expect(routePermissions("/spa/reservations")).toEqual([
      PERMISSIONS.SCREEN_MEDICAL,
    ]);
    expect(routePermissions("/tours")).toEqual([PERMISSIONS.SCREEN_TOURS]);
  });

  it("hk-policy stays under settings screen, not /hk prefix", () => {
    expect(routePermissions("/settings/hk-policy")).toEqual([
      PERMISSIONS.SCREEN_SETTINGS,
    ]);
    expect(routePermissions("/hk")).toEqual([PERMISSIONS.SCREEN_HK]);
  });
});
