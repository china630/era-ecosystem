#!/usr/bin/env node
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === ".next") continue;
      walk(p, out);
    } else if (name.endsWith(".tsx") || name.endsWith(".ts")) out.push(p);
  }
  return out;
}

for (const file of walk(root)) {
  if (!file.includes("era-")) continue;
  let s = fs.readFileSync(file, "utf8");
  const orig = s;
  s = s.replace(/SatelliteSatelliteLocaleToggle/g, "SatelliteLocaleToggle");
  if (s.includes("eraIntlOnError") && !s.includes('from "@era/i18n-common"')) {
    s = s.replace(
      /^(import .+\n)/m,
      '$1import { eraIntlMessageFallback, eraIntlOnError } from "@era/i18n-common";\n',
    );
  }
  if (s !== orig) {
    fs.writeFileSync(file, s, "utf8");
    console.log("fixed", path.relative(root, file));
  }
}
