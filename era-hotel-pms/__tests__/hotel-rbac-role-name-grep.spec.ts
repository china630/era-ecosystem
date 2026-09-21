import fs from "node:fs";
import path from "node:path";
import { HOTEL_LEGACY_PERMISSION_STRINGS } from "@/lib/auth/hotel-permission-rename";

/**
 * Wave 1: role-name allowlists must not gate ops (except documented S2S / seed).
 * Wave 2: legacy permission strings must not appear in runtime src/app.
 */
describe("hotel RBAC role-name grep gate", () => {
  const ROOT = path.join(__dirname, "..");
  const SCAN_DIRS = ["app", "src"];
  const FORBIDDEN = [
    "OWNER_IMPORT_ROLES",
    "BRIDGE_ROLES",
    "roleMayUseBridge(",
  ];
  const ALLOW_PATH_FRAGMENTS = [
    `${path.sep}__tests__${path.sep}`,
    `${path.sep}prisma${path.sep}`,
    "hotel-roles.ts",
    "staff-provision.ts",
  ];
  const LEGACY_ALLOW = [
    `${path.sep}hotel-permission-rename.ts`,
  ];

  function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name === "node_modules" || ent.name === ".next") continue;
        walk(p, out);
      } else if (/\.(ts|tsx)$/.test(ent.name)) {
        out.push(p);
      }
    }
    return out;
  }

  function allowed(file: string): boolean {
    return ALLOW_PATH_FRAGMENTS.some((f) => file.includes(f));
  }

  it("ops sources do not use role-name import/bridge allowlists", () => {
    const hits: string[] = [];
    for (const d of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, d))) {
        if (allowed(file)) continue;
        const src = fs.readFileSync(file, "utf8");
        for (const needle of FORBIDDEN) {
          if (src.includes(needle)) {
            hits.push(`${path.relative(ROOT, file)}: ${needle}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("hasPermission( is not used as a request gate outside the template helper", () => {
    const hits: string[] = [];
    for (const d of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, d))) {
        if (allowed(file)) continue;
        if (file.replace(/\\/g, "/").endsWith("src/lib/auth/permissions.ts")) continue;
        const src = fs.readFileSync(file, "utf8");
        if (src.includes("hasPermission(")) {
          hits.push(path.relative(ROOT, file));
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it("Wave 2: no legacy permission strings in src/app outside rename map", () => {
    const hits: string[] = [];
    for (const d of SCAN_DIRS) {
      for (const file of walk(path.join(ROOT, d))) {
        if (LEGACY_ALLOW.some((f) => file.includes(f))) continue;
        const src = fs.readFileSync(file, "utf8");
        for (const legacy of HOTEL_LEGACY_PERMISSION_STRINGS) {
          // Match quoted legacy only (avoid partial false positives).
          if (
            src.includes(`'${legacy}'`) ||
            src.includes(`"${legacy}"`) ||
            src.includes(`\`${legacy}\``)
          ) {
            hits.push(`${path.relative(ROOT, file)}: ${legacy}`);
          }
        }
      }
    }
    expect(hits).toEqual([]);
  });
});
