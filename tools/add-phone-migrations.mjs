#!/usr/bin/env node
/** Copy phone migration SQL to satellites with User.phone in schema. */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function userTableName(schemaText) {
  const mapMatch = schemaText.match(/model User[\s\S]*?@@map\("([^"]+)"\)/);
  if (mapMatch) return mapMatch[1];
  return "User";
}

function phoneMigrationSql(table) {
  const quoted = `"${table}"`;
  const index = `"${table}_phone_key"`;
  return `-- Add optional phone column for multi-credential login (login / email / phone)
ALTER TABLE ${quoted} ADD COLUMN IF NOT EXISTS "phone" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS ${index} ON ${quoted}("phone") WHERE "phone" IS NOT NULL;
`;
}

const sats = [
  "era-fnb-pos",
  "era-wholesale",
  "era-logistics",
  "era-construction",
  "era-retail-pos",
  "era-hotel-pms",
  "era-clinic",
  "era-crm",
  "era-auto-service",
];

for (const sat of sats) {
  const schemaPath = path.join(root, sat, "prisma/schema.prisma");
  if (!fs.existsSync(schemaPath)) continue;
  const text = fs.readFileSync(schemaPath, "utf8");
  if (!text.includes("phone")) continue;
  const table = userTableName(text);
  const migDir = path.join(root, sat, "prisma/migrations/20260530120000_user_phone");
  fs.mkdirSync(migDir, { recursive: true });
  fs.writeFileSync(path.join(migDir, "migration.sql"), phoneMigrationSql(table), "utf8");
  console.log("wrote migration:", sat, "table:", table);
}
