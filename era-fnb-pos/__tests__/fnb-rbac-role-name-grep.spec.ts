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

describe("fnb rbac role-name hygiene", () => {
  it("app/api does not call requireAnyRole", () => {
    const apiRoot = path.join(ROOT, "app", "api");
    const hits: string[] = [];
    for (const file of walk(apiRoot)) {
      const text = fs.readFileSync(file, "utf8");
      if (text.includes("requireAnyRole")) {
        hits.push(path.relative(ROOT, file));
      }
    }
    expect(hits).toEqual([]);
  });

  it("pay route does not gate on session.role === FB_WAITER", () => {
    const pay = fs.readFileSync(
      path.join(ROOT, "app", "api", "tickets", "[id]", "pay", "route.ts"),
      "utf8",
    );
    expect(pay).not.toMatch(/session\.role\s*===\s*FB_ROLES\.WAITER/);
    expect(pay).toMatch(/TICKETS_PAY/);
  });
});
