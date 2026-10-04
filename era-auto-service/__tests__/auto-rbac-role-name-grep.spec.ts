import fs from "fs";
import path from "path";

const ROOT = path.join(__dirname, "..");

/** Role names grant nothing: doors check `screen:` / `api:` / `admin:` grants. The owner bypass is the one exception. */
const ROLE_NAME_DOOR =
  /sessionHasRole\(|requireAnyRole\(|role(?:\.code)?\s*[!=]==\s*(?!OWNER_ROLE_CODE\b|"string")["'A-Z]|_ROLES\.has\(/;

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("role-name grep on doors", () => {
  it("app/ and src/ have no role-name doors", () => {
    const files = [...walk(path.join(ROOT, "app")), ...walk(path.join(ROOT, "src")), path.join(ROOT, "middleware.ts")];
    const hits = files
      .filter((f) => ROLE_NAME_DOOR.test(fs.readFileSync(f, "utf8")))
      .map((f) => path.relative(ROOT, f));
    expect(hits).toEqual([]);
  });
});
