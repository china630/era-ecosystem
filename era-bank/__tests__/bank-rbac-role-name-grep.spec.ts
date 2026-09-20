import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");

function walk(dir: string, acc: string[] = []): string[] {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(ent.name)) {
      acc.push(full);
    }
  }
  return acc;
}

describe("bank rbac role-name hygiene", () => {
  it("bff-proxy does not gate on role === TELLER", () => {
    const text = fs.readFileSync(
      path.join(ROOT, "src", "lib", "bff-proxy.ts"),
      "utf8",
    );
    expect(text).not.toMatch(/role\s*===\s*["']TELLER["']/);
    expect(text).toMatch(/denyUnlessAnyPermission/);
  });

  it("middleware uses routePermissions not ROLE_NAV_ALLOW", () => {
    const text = fs.readFileSync(path.join(ROOT, "middleware.ts"), "utf8");
    expect(text).toMatch(/routePermissions/);
    expect(text).not.toMatch(/ROLE_NAV_ALLOW/);
  });

  it("app/api does not use limitsJson.canApprove as door", () => {
    const apiRoot = path.join(ROOT, "app", "api");
    const hits: string[] = [];
    for (const file of walk(apiRoot)) {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("limits.canApprove") || text.includes("canApprove === true")) {
        hits.push(path.relative(ROOT, file));
      }
    }
    expect(hits).toEqual([]);
  });
});
