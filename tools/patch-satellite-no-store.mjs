#!/usr/bin/env node
/**
 * Patch industry satellites: redirectNoStore in middleware + no-store headers in next.config.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SATELLITES = [
  "era-retail-pos",
  "era-logistics",
  "era-construction",
  "era-clinic",
  "era-hotel-pms",
  "era-fnb-pos",
  "era-crm",
  "era-auto-service",
  "era-wholesale",
];

const HEADERS_BLOCK = `  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },`;

function patchNextConfig(dir) {
  const file = path.join(root, dir, "next.config.ts");
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("no-store, no-cache, must-revalidate")) {
    console.log(`  next.config: already patched (${dir})`);
    return;
  }
  src = src.replace(
    /transpilePackages:\s*\[[^\]]+\],/,
    (m) => `${m}\n${HEADERS_BLOCK}`,
  );
  fs.writeFileSync(file, src);
  console.log(`  next.config: patched (${dir})`);
}

function patchStandardMiddleware(dir) {
  const file = path.join(root, dir, "middleware.ts");
  if (!fs.existsSync(file)) {
    console.log(`  middleware: skip — no file (${dir})`);
    return;
  }
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("redirectNoStore")) {
    console.log(`  middleware: already patched (${dir})`);
    return;
  }
  if (!src.includes('from "@era/satellite-kit"')) {
    console.log(`  middleware: skip — non-standard (${dir})`);
    return;
  }
  src = src.replace(
    /(\s+verifySatelliteSession,\n)(\} from "@era\/satellite-kit";)/,
    `$1  redirectNoStore,\n$2`,
  );
  src = src.replace(/return NextResponse\.redirect\(([^)]+)\);/g, "return redirectNoStore($1);");
  fs.writeFileSync(file, src);
  console.log(`  middleware: patched (${dir})`);
}

function patchHotelMiddleware() {
  const file = path.join(root, "era-hotel-pms", "middleware.ts");
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes("redirectNoStore")) {
    console.log("  middleware: already patched (era-hotel-pms)");
    return;
  }
  src = src.replace(
    "import { NextResponse } from 'next/server';",
    `import { NextResponse } from 'next/server';\nimport { redirectNoStore } from '@era/satellite-kit';`,
  );
  src = src.replace(
    /return NextResponse\.redirect\(loginUrl\);/g,
    "return redirectNoStore(loginUrl);",
  );
  fs.writeFileSync(file, src);
  console.log("  middleware: patched (era-hotel-pms)");
}

for (const dir of SATELLITES) {
  console.log(dir);
  patchNextConfig(dir);
  if (dir === "era-hotel-pms") {
    patchHotelMiddleware();
  } else {
    patchStandardMiddleware(dir);
  }
}

console.log("Done.");
