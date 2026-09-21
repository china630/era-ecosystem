import fs from "fs";
import path from "path";
import { routePermissions } from "@/lib/auth/page-route-permissions";

const APP_ROOT = path.join(__dirname, "..", "app");

function listPageFiles(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "api") continue;
      listPageFiles(full, acc);
    } else if (ent.name === "page.tsx" || ent.name === "page.ts") {
      acc.push(full);
    }
  }
  return acc;
}

function fileToPathname(file: string): string {
  const rel = path.relative(APP_ROOT, path.dirname(file)).replace(/\\/g, "/");
  if (!rel || rel === ".") return "/";
  return `/${rel}`
    .replace(/\/\([^)]+\)/g, "")
    .replace(/\/\[\.\.\.[^\]]+\]/g, "")
    .replace(/\/\[[^\]]+\]/g, "/x");
}

const PUBLIC = new Set(["/login", "/sso/callback", "/help"]);

describe("bank page route inventory", () => {
  it("every staff page maps via routePermissions (fail-closed)", () => {
    const pages = listPageFiles(APP_ROOT);
    expect(pages.length).toBeGreaterThan(5);
    const misses: string[] = [];
    for (const file of pages) {
      const pathname = fileToPathname(file);
      if (
        [...PUBLIC].some(
          (p) => pathname === p || pathname.startsWith(p + "/"),
        )
      ) {
        continue;
      }
      if (pathname.startsWith("/help")) continue;
      if (!routePermissions(pathname)) {
        misses.push(`${pathname} ← ${path.relative(APP_ROOT, file)}`);
      }
    }
    expect(misses).toEqual([]);
  });
});
