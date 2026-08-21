/**
 * Add organizationId to satellite tenant roots. Brace-aware (does not touch enums).
 * node scripts/wave345-shared-schema.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

function extractModel(src, name) {
  const start = src.indexOf(`model ${name} {`);
  if (start < 0) return null;
  const brace = src.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) {
        return { start, end: i + 1, text: src.slice(start, i + 1) };
      }
    }
  }
  throw new Error(`Unclosed model ${name}`);
}

function tableName(modelText, modelName) {
  const map = modelText.match(/@@map\("([^"]+)"\)/);
  return map ? map[1] : modelName;
}

function fieldDbName(modelText, field) {
  const line = modelText.split("\n").find((l) => new RegExp(`^\\s+${field}\\s+`).test(l));
  if (!line) return field;
  const mapped = line.match(/@map\("([^"]+)"\)/);
  return mapped ? mapped[1] : field;
}

function insertOrgField(text, orgLine) {
  if (/\borganizationId\b/.test(text)) return text;
  return text.replace(/(^\s+id\s+[^\n]+\n)/m, `$1${orgLine}\n`);
}

function stripFieldUnique(text, field) {
  return text.replace(
    new RegExp(`^(\\s+${field}\\s+\\S+[^\\n]*?)\\s+@unique\\b`, "m"),
    "$1",
  );
}

function ensureBlockAttr(text, attr) {
  if (text.includes(attr)) return text;
  return text.replace(/\n\}$/, `\n  ${attr}\n}`);
}

function patchModel(text, { orgLine, dropUniques = [], expandUniques = [] }) {
  let next = insertOrgField(text, orgLine);
  for (const f of dropUniques) next = stripFieldUnique(next, f);
  for (const f of dropUniques) {
    next = ensureBlockAttr(next, `@@unique([organizationId, ${f}])`);
  }
  if (expandUniques.length) {
    const inner = expandUniques.join(", ");
    next = next.replace(`@@unique([${inner}])`, `@@unique([organizationId, ${inner}])`);
  }
  next = ensureBlockAttr(next, "@@index([organizationId])");
  return next;
}

function applySpec(relSchema, spec) {
  const file = path.join(ROOT, relSchema);
  let src = fs.readFileSync(file, "utf8");
  const sql = [
    `-- SHARED-schema: additive organizationId on tenant roots`,
    `CREATE TABLE IF NOT EXISTS "_era_organization_bind" (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "organizationId" TEXT NOT NULL,
  "boundAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "boundBy" TEXT
);`,
  ];

  for (const item of spec.models) {
    const found = extractModel(src, item.name);
    if (!found) {
      console.warn("missing model", spec.label, item.name);
      continue;
    }
    const patched = patchModel(found.text, {
      orgLine: spec.orgLine,
      dropUniques: item.dropUniques || [],
      expandUniques: item.expandUniques || [],
    });
    src = src.slice(0, found.start) + patched + src.slice(found.end);

    const table = tableName(patched, item.name);
    const col = spec.col;
    if (!/\borganizationId\b/.test(found.text)) {
      sql.push(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${col}" TEXT NOT NULL DEFAULT 'unbound';`,
      );
    }
    sql.push(
      `UPDATE "${table}" t SET "${col}" = COALESCE((SELECT b."organizationId" FROM "_era_organization_bind" b WHERE b.id = 1 LIMIT 1), t."${col}") WHERE t."${col}" = 'unbound';`,
    );
    for (const f of item.dropUniques || []) {
      const dbField = fieldDbName(patched, f);
      sql.push(`DROP INDEX IF EXISTS "${item.name}_${f}_key";`);
      sql.push(`DROP INDEX IF EXISTS "${table}_${dbField}_key";`);
      sql.push(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_${col}_${dbField}_key" ON "${table}"("${col}", "${dbField}");`,
      );
    }
    if (item.expandUniques?.length) {
      sql.push(`DROP INDEX IF EXISTS "${item.name}_${item.expandUniques.join("_")}_key";`);
      const cols = [col, ...item.expandUniques.map((f) => fieldDbName(patched, f))];
      sql.push(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_${cols.join("_")}_key" ON "${table}"(${cols.map((c) => `"${c}"`).join(", ")});`,
      );
    }
    sql.push(`CREATE INDEX IF NOT EXISTS "${table}_${col}_idx" ON "${table}"("${col}");`);
  }

  if (spec.postProcess) src = spec.postProcess(src);

  fs.writeFileSync(file, src, "utf8");
  const dest = path.join(ROOT, spec.migration);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, `${sql.join("\n")}\n`, "utf8");
  console.log("ok", spec.label);
}

const clinicOrg = `  organizationId String @default("unbound") @map("organization_id")`;
const hotelOrg = `  organizationId String @default("unbound")`;
const fnbOrg = `  organizationId String @default("unbound") @map("organization_id")`;

applySpec("era-clinic/prisma/schema.prisma", {
  label: "clinic",
  orgLine: clinicOrg,
  col: "organization_id",
  migration: "era-clinic/prisma/migrations/20260817140000_shared_schema_roots/migration.sql",
  models: [
    { name: "Tenant", dropUniques: ["code"] },
    { name: "Outlet" },
    { name: "PatientRef", dropUniques: ["refCode"] },
    { name: "Practitioner", dropUniques: ["code"] },
    { name: "Room", dropUniques: ["code"] },
    { name: "Resource", dropUniques: ["code"] },
    { name: "ResourceBooking" },
    { name: "Appointment" },
    { name: "Visit" },
    { name: "LabOrder" },
    { name: "Modality", dropUniques: ["code"] },
    { name: "DiagnosticService", dropUniques: ["code"] },
    { name: "ImagingPhrase", dropUniques: ["code"] },
    { name: "ClinicLookup", expandUniques: ["kind", "code"] },
    { name: "ProcedureCompatibilityRule" },
    { name: "ProcedureType", dropUniques: ["code"] },
    { name: "ProcedureRotationRule", dropUniques: ["code"] },
    { name: "ProcedureSubstitutionRule" },
    { name: "ProcedureRule" },
    { name: "PatientContraindication" },
    { name: "ServiceCatalogCache", dropUniques: ["code"] },
    { name: "VisitDiscountAudit" },
    { name: "ClinicalTemplate", dropUniques: ["code"] },
    { name: "ProgramTemplate", dropUniques: ["code"] },
    { name: "ProgramInstance" },
    { name: "ProcedureOrder" },
    { name: "InpatientAdmission" },
    { name: "Ward", dropUniques: ["code"] },
    { name: "Bed" },
    { name: "BedAssignment" },
    { name: "CpoeEntry" },
    { name: "ClinicShift", dropUniques: ["code"] },
    { name: "ClinicReceipt" },
    { name: "ProcedureChargeLog" },
    { name: "ProcessedEvent", dropUniques: ["correlationId"] },
    { name: "Role", dropUniques: ["code"] },
    { name: "User", dropUniques: ["login"] },
    { name: "SatelliteAuditLog" },
    { name: "QueueTicket" },
    { name: "LisFileProfile", dropUniques: ["name"] },
  ],
});

applySpec("era-hotel-pms/prisma/schema.prisma", {
  label: "hotel",
  orgLine: hotelOrg,
  col: "organizationId",
  migration: "era-hotel-pms/prisma/migrations/20260817140000_shared_schema_roots/migration.sql",
  models: [
    { name: "HotelProfile", dropUniques: ["propertyCode"] },
    { name: "Role", dropUniques: ["code"] },
    { name: "User", dropUniques: ["login"] },
    { name: "HotelLookup", expandUniques: ["kind", "code"] },
    { name: "RoomView", dropUniques: ["code"] },
    { name: "BedType", dropUniques: ["code"] },
    { name: "RoomType", dropUniques: ["code"] },
    { name: "Room", dropUniques: ["roomNumber"] },
    { name: "MealPlan", dropUniques: ["code"] },
    { name: "RatePlan", dropUniques: ["code"] },
    { name: "AddOn", dropUniques: ["code"] },
    { name: "ProcedureService", dropUniques: ["code"] },
    { name: "Department", dropUniques: ["code"] },
    { name: "RevenueCode", dropUniques: ["code"] },
    { name: "BookingSource", dropUniques: ["code"] },
    { name: "Agency", dropUniques: ["code"] },
    { name: "SalesContract", dropUniques: ["code"] },
    { name: "ReservationGroup", dropUniques: ["code"] },
    { name: "AllotmentBlock", dropUniques: ["code"] },
    { name: "Guest" },
    { name: "Reservation" },
    { name: "Folio" },
    { name: "PromotionCode", dropUniques: ["code"] },
    { name: "Housekeeper", dropUniques: ["code"] },
    { name: "MinibarItem", dropUniques: ["code"] },
    { name: "SpaPlace", dropUniques: ["code"] },
    { name: "Channel", dropUniques: ["code"] },
    { name: "Stay" },
    { name: "CashShift" },
    { name: "BusinessDay" },
    { name: "NightAuditRun" },
    { name: "HousekeepingTask" },
    { name: "PosResource", dropUniques: ["code"] },
    { name: "BanquetSaloon", dropUniques: ["code"] },
    { name: "BanquetMenuPackage" },
    { name: "BanquetEvent" },
    { name: "RoomClosure" },
    { name: "LostFoundItem" },
    { name: "SatelliteAuditLog" },
  ],
  postProcess: (src) =>
    src.replace(
      /organizationId\s+String\s+@default\("nafta-sanatorium-org"\)/,
      'organizationId           String    @default("unbound")',
    ),
});

applySpec("era-fnb-pos/prisma/schema.prisma", {
  label: "fnb",
  orgLine: fnbOrg,
  col: "organization_id",
  migration: "era-fnb-pos/prisma/migrations/20260817140000_shared_schema_roots/migration.sql",
  models: [
    { name: "Outlet", dropUniques: ["code"] },
    { name: "DeliveryInboxOrder", dropUniques: ["externalRef"] },
    { name: "PosTable" },
    { name: "TableReservation" },
    { name: "MenuCategory" },
    { name: "MenuItem" },
    { name: "PosShift" },
    { name: "Ticket" },
    { name: "StaffRoster", dropUniques: ["staffCode"] },
    { name: "PinClockEvent" },
    { name: "Role", dropUniques: ["code"] },
    { name: "User", dropUniques: ["login"] },
    { name: "SatelliteAuditLog" },
  ],
});
