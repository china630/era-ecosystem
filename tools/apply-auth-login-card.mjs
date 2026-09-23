#!/usr/bin/env node
/** Public /help middleware + optional User.phone on satellite Prisma schema.
 *  Does not write /login pages or auth routes — copy era-clinic/app/login/page.tsx. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const SATELLITES = [
  "era-retail-pos",
  "era-fnb-pos",
  "era-wholesale",
  "era-clinic",
  "era-logistics",
  "era-construction",
  "era-crm",
  "era-auto-service",
];

/** Login UI canon is era-clinic/app/login/page.tsx — this script must not overwrite it. */

function patchMiddleware(file) {
  if (!fs.existsSync(file)) return;
  let src = fs.readFileSync(file, "utf8");
  if (src.includes('pathname === "/help"')) {
    console.log("skip middleware (help already public):", file);
    return;
  }
  const needle = 'pathname === "/sso/callback"';
  if (!src.includes(needle)) {
    console.log("skip middleware (pattern not found):", file);
    return;
  }
  src = src.replace(
    needle,
    'pathname === "/sso/callback" || pathname === "/help" || pathname.startsWith("/help/")',
  );
  fs.writeFileSync(file, src, "utf8");
  console.log("patched middleware:", file);
}

function addPhoneToSchema(schemaFile) {
  if (!fs.existsSync(schemaFile)) return;
  let src = fs.readFileSync(schemaFile, "utf8");
  if (src.includes("phone")) {
    console.log("skip schema (phone exists):", schemaFile);
    return;
  }
  src = src.replace(
    /email\s+String\?\s*\n/,
    "email           String?\n  phone           String?   @unique\n",
  );
  fs.writeFileSync(schemaFile, src, "utf8");
  console.log("patched schema phone:", schemaFile);
}

for (const sat of SATELLITES) {
  patchMiddleware(path.join(root, sat, "middleware.ts"));
  addPhoneToSchema(path.join(root, sat, "prisma/schema.prisma"));
}

console.log("done");
