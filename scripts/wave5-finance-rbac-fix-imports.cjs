/**
 * Fix missing imports + duplicate @Permissions after Wave 5 migrate.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "../era-finance-core/apps/api/src");

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (entry.endsWith(".controller.ts")) out.push(p);
  }
  return out;
}

function relImport(fromFile, toAbs) {
  let rel = path.relative(path.dirname(fromFile), toAbs).replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel.replace(/\.ts$/, "");
}

let fixed = 0;
for (const file of walk(SRC)) {
  let src = fs.readFileSync(file, "utf8");
  const orig = src;

  // Dedupe consecutive identical Permissions lines
  src = src.replace(
    /(@Permissions\(CP_PERMISSION\.[A-Z_]+\))\r?\n\1\r?\n/g,
    "$1\n",
  );

  const usesCp = /CP_PERMISSION\./.test(src);
  const usesPerm = /@Permissions\(/.test(src);
  const usesGuard = /\bPermissionsGuard\b/.test(src);

  if (!usesCp && !usesPerm && !usesGuard) continue;

  if (usesCp && !/from ["']@era\/contracts["']/.test(src)) {
    src = `import { CP_PERMISSION } from "@era/contracts";\n` + src;
  } else if (usesCp && /from ["']@era\/contracts["']/.test(src) && !/CP_PERMISSION/.test(src.match(/import\s*\{[^}]*\}\s*from\s*["']@era\/contracts["']/)?.[0] || "")) {
    src = src.replace(
      /import\s*\{([^}]+)\}\s*from\s*["']@era\/contracts["'];/,
      (m, inner) => {
        if (inner.includes("CP_PERMISSION")) return m;
        return `import { ${inner.trim().replace(/,$/, "")}, CP_PERMISSION } from "@era/contracts";`;
      },
    );
  }

  const permPath = relImport(
    file,
    path.join(SRC, "common/decorators/permissions.decorator.ts"),
  );
  const guardPath = relImport(
    file,
    path.join(SRC, "common/guards/permissions.guard.ts"),
  );

  if (usesPerm && !/permissions\.decorator/.test(src)) {
    src = src.replace(
      /import \{ CP_PERMISSION \} from "@era\/contracts";\n/,
      `import { CP_PERMISSION } from "@era/contracts";\nimport { Permissions } from "${permPath}";\n`,
    );
    if (!/permissions\.decorator/.test(src)) {
      src = `import { Permissions } from "${permPath}";\n` + src;
    }
  } else if (usesPerm && /permissions\.decorator/.test(src) && !/\bPermissions\b/.test(src.split("\n").find((l) => l.includes("permissions.decorator")) || "")) {
    src = src.replace(
      /import\s*\{([^}]*)\}\s*from\s*["']([^"']*permissions\.decorator)["'];/,
      (m, inner, from) => {
        if (/\bPermissions\b/.test(inner)) return m;
        return `import { Permissions, ${inner.trim()} } from "${from}";`;
      },
    );
  }

  if (usesGuard && !/permissions\.guard/.test(src)) {
    const insertAfter = src.includes('permissions.decorator"')
      ? /import \{ Permissions[^}]*\} from "[^"]+";\n/
      : /import \{ CP_PERMISSION \} from "@era\/contracts";\n/;
    if (insertAfter.test(src)) {
      src = src.replace(
        insertAfter,
        (m) => `${m}import { PermissionsGuard } from "${guardPath}";\n`,
      );
    } else {
      src = `import { PermissionsGuard } from "${guardPath}";\n` + src;
    }
  }

  // Remove empty leftover imports
  src = src.replace(/import\s*\{\s*\}\s*from\s*["'][^"']+["'];\s*\n/g, "");

  if (src !== orig) {
    fs.writeFileSync(file, src, "utf8");
    fixed++;
    console.log("fixed", path.relative(SRC, file));
  }
}
console.log("fixed files", fixed);
