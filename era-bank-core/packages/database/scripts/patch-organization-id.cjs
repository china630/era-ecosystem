/**
 * One-shot: add organizationId to all bank-core models + generate migration SQL.
 * Usage: node era-bank-core/packages/database/scripts/patch-organization-id.mjs
 */
const fs = require("fs");
const path = require("path");

const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
const migrationDir = path.join(
  __dirname,
  "../prisma/migrations/20260817190000_shared_schema_organization_id",
);
const migrationPath = path.join(migrationDir, "migration.sql");

const ORG_FIELD =
  '  organizationId String @default("unbound") @map("organization_id")\n';

/** Field-level @unique that should become @@unique([organizationId, field]). */
const CONVERT_UNIQUE_FIELDS = new Set([
  "iban",
  "idempotencyKey",
  "cardToken",
  "processorRef",
  "productTemplateId",
  "keyHash",
  "engineOrderId",
]);

function snake(name) {
  return name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`).replace(/^_/, "");
}

function patchModel(block) {
  const nameMatch = block.match(/^model\s+(\w+)\s*\{/);
  if (!nameMatch) return { block, meta: null };
  const modelName = nameMatch[1];
  if (block.includes("organizationId")) {
    const mapMatch = block.match(/@@map\("([^"]+)"\)/);
    return {
      block,
      meta: {
        modelName,
        table: mapMatch ? mapMatch[1] : modelName,
        convertedUniques: [],
        alreadyHad: true,
      },
    };
  }

  let body = block;
  const convertedUniques = [];

  // Insert organizationId after id field line
  if (!/organizationId/.test(body)) {
    body = body.replace(
      /(model\s+\w+\s*\{\s*\n\s*id\s+[^\n]+\n)/,
      `$1${ORG_FIELD}`,
    );
  }

  // Convert field-level @unique on business codes
  body = body.replace(
    /^(\s+)(\w+)(\s+String(?:\??)?(?:\s+\[[^\]]*\])?(?:\s+@\w+(?:\([^)]*\))?)*)\s+@unique(\s+@map\("[^"]+"\))?\s*$/gm,
    (full, indent, field, rest, mapPart) => {
      if (!CONVERT_UNIQUE_FIELDS.has(field)) return full;
      convertedUniques.push(field);
      const map = mapPart || "";
      return `${indent}${field}${rest}${map}`;
    },
  );

  // Also handle: field Type @map(...) @unique
  body = body.replace(
    /^(\s+)(\w+)(\s+String(?:\??)?(?:\s+\[[^\]]*\])?(?:\s+@\w+(?:\([^)]*\))?)*)\s+@map\("([^"]+)"\)\s+@unique\s*$/gm,
    (full, indent, field, rest, mapName) => {
      if (!CONVERT_UNIQUE_FIELDS.has(field)) return full;
      if (convertedUniques.includes(field)) return full;
      convertedUniques.push(field);
      return `${indent}${field}${rest} @map("${mapName}")`;
    },
  );

  // Add @@unique([organizationId, field]) for converted
  for (const field of convertedUniques) {
    const uniqLine = `  @@unique([organizationId, ${field}])\n`;
    if (!body.includes(`@@unique([organizationId, ${field}])`)) {
      if (/@@map\(/.test(body)) {
        body = body.replace(/(\s+)(@@map\("[^"]+"\))/, `\n${uniqLine}$1$2`);
      } else {
        body = body.replace(/\n\}/, `\n${uniqLine}}`);
      }
    }
  }

  // Add @@index([organizationId])
  if (!body.includes("@@index([organizationId])")) {
    if (/@@map\(/.test(body)) {
      body = body.replace(
        /(\s+)(@@map\("[^"]+"\))/,
        `\n  @@index([organizationId])$1$2`,
      );
    } else {
      body = body.replace(/\n\}/, `\n  @@index([organizationId])\n}`);
    }
  }

  const mapMatch = body.match(/@@map\("([^"]+)"\)/);
  return {
    block: body,
    meta: {
      modelName,
      table: mapMatch ? mapMatch[1] : modelName,
      convertedUniques,
      alreadyHad: false,
    },
  };
}

function main() {
  let schema = fs.readFileSync(schemaPath, "utf8");
  if (schema.charCodeAt(0) === 0xfeff) schema = schema.slice(1);

  const metas = [];
  const patched = schema.replace(/^model\s+\w+\s*\{[\s\S]*?\n\}/gm, (block) => {
    const { block: next, meta } = patchModel(block);
    if (meta) metas.push(meta);
    return next;
  });

  fs.writeFileSync(schemaPath, patched, "utf8");

  const sql = [];
  sql.push(
    "-- SHARED-schema: additive organizationId (CP-TENANT-01 / B7). No SHARED bank pool this edition.",
  );
  sql.push("CREATE TABLE IF NOT EXISTS \"_era_organization_bind\" (");
  sql.push("  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),");
  sql.push('  "organizationId" TEXT NOT NULL,');
  sql.push('  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),');
  sql.push('  "boundBy" TEXT');
  sql.push(");");
  sql.push("");

  for (const m of metas) {
    if (m.alreadyHad) continue;
    const t = m.table;
    sql.push(
      `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';`,
    );
    // Prefer bind, else existing bank_org_id when present
    sql.push(
      `UPDATE "${t}" x SET "organization_id" = COALESCE(` +
        `(SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), ` +
        `(CASE WHEN EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_name = '${t}' AND c.column_name = 'bank_org_id') THEN x.bank_org_id ELSE NULL END), ` +
        `x."organization_id") WHERE x."organization_id" = 'unbound';`,
    );

    for (const field of m.convertedUniques) {
      const col = snake(field);
      // Prisma default unique index names use camelCase field on mapped tables sometimes;
      // drop both camel and snake variants.
      sql.push(`DROP INDEX IF EXISTS "${t}_${field}_key";`);
      sql.push(`DROP INDEX IF EXISTS "${t}_${col}_key";`);
      sql.push(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${t}_organization_id_${field}_key" ON "${t}"("organization_id", "${field === "idempotencyKey" || field === "cardToken" || field === "processorRef" || field === "productTemplateId" ? col : field}");`,
      );
    }

    // Fix column names for @map fields in unique indexes
    // Re-do converted uniques more carefully below — rewrite last unique lines

    sql.push(
      `CREATE INDEX IF NOT EXISTS "${t}_organization_id_idx" ON "${t}"("organization_id");`,
    );
    sql.push("");
  }

  // Fix unique index column names: Prisma @map uses snake for mapped fields
  const FIELD_COL = {
    idempotencyKey: "idempotency_key",
    cardToken: "card_token",
    processorRef: "processor_ref",
    productTemplateId: "product_template_id",
    iban: "iban",
  };

  // Regenerate SQL cleanly for converted uniques
  const sql2 = [];
  sql2.push(
    "-- SHARED-schema: additive organizationId (CP-TENANT-01 / B7). No SHARED bank pool this edition.",
  );
  sql2.push("CREATE TABLE IF NOT EXISTS \"_era_organization_bind\" (");
  sql2.push("  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),");
  sql2.push('  "organizationId" TEXT NOT NULL,');
  sql2.push('  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),');
  sql2.push('  "boundBy" TEXT');
  sql2.push(");");
  sql2.push("");

  for (const m of metas) {
    if (m.alreadyHad) continue;
    const t = m.table;
    sql2.push(
      `ALTER TABLE "${t}" ADD COLUMN IF NOT EXISTS "organization_id" TEXT NOT NULL DEFAULT 'unbound';`,
    );
    sql2.push(
      `DO $$ BEGIN ` +
        `IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = '${t}' AND column_name = 'bank_org_id') THEN ` +
        `UPDATE "${t}" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x.bank_org_id, x."organization_id") WHERE x."organization_id" = 'unbound'; ` +
        `ELSE ` +
        `UPDATE "${t}" x SET "organization_id" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), x."organization_id") WHERE x."organization_id" = 'unbound'; ` +
        `END IF; END $$;`,
    );

    for (const field of m.convertedUniques) {
      const col = FIELD_COL[field] || field;
      sql2.push(`DROP INDEX IF EXISTS "${t}_${field}_key";`);
      sql2.push(`DROP INDEX IF EXISTS "${t}_${col}_key";`);
      sql2.push(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${t}_organization_id_${field}_key" ON "${t}"("organization_id", "${col}");`,
      );
    }

    sql2.push(
      `CREATE INDEX IF NOT EXISTS "${t}_organization_id_idx" ON "${t}"("organization_id");`,
    );
    sql2.push("");
  }

  fs.mkdirSync(migrationDir, { recursive: true });
  fs.writeFileSync(migrationPath, sql2.join("\n") + "\n", "utf8");

  console.log(
    `Patched ${metas.filter((m) => !m.alreadyHad).length} models; migration → ${migrationPath}`,
  );
  const converted = metas.filter((m) => m.convertedUniques.length);
  console.log(
    "Converted uniques:",
    converted.map((m) => `${m.modelName}:{${m.convertedUniques.join(",")}}`).join(" "),
  );
}

main();
