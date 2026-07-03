#!/usr/bin/env node
/**
 * Layer audit: data-model integration compliance (MDM, data-hub, HR provision).
 * Usage: node scripts/audit-data-model-integration.mjs [--json] [--domain MDM]
 */
import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";
import { pathToFileURL } from "url";
import {
  ROOT,
  listEraApps,
  walkRepo,
  readPrismaSchema,
  modelFields,
  scanHubBoundary,
  scanWorkforceDualPath,
  scanWorkforceV3Publisher,
  scanWorkforcePiiLeak,
  staffModelHasForbiddenIdentifiers,
  schemaHasPlaintextPii,
  guestHasIdentityColumns,
  scanSatelliteKitHubDrift,
  createIssue,
} from "./audit-lib.mjs";
import { INDUSTRY_APPS } from "./audit-allowlists.mjs";

const INDUSTRY_SET = new Set(INDUSTRY_APPS);

function scanApp(app) {
  const schema = readPrismaSchema(app);
  const files = walkRepo(join(ROOT, app));
  const ts = files.filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"));
  const text = ts.map((f) => readFileSync(f, "utf8")).join("\n");
  const hub = scanHubBoundary(app, ts);

  return {
    app,
    schemaPath: schema ? `${app}/prisma/schema.prisma` : null,
    hasGlobalPersonId: schema?.includes("globalPersonId") ?? false,
    plaintextPii: schemaHasPlaintextPii(schema),
    guestIdentityColumns: app === "era-hotel-pms" && guestHasIdentityColumns(schema),
    linkPersonIdentity: text.includes("linkPersonIdentity"),
    resolvePersonIdentity: text.includes("resolvePersonIdentity"),
    lookupOnlyFin: text.includes("lookupGlobalPersonByFin") && !text.includes("linkPersonIdentity"),
    ...hub,
    workforceDualPath: scanWorkforceDualPath(app, ts, text),
    practitionerFinanceLink:
      schema?.includes("financeEmployeeId") && schema?.includes("model Practitioner"),
    staffProvision:
      text.includes("staff-provision") ||
      text.includes("handleStaffProvision") ||
      text.includes("SATELLITE_STAFF_PROVISIONED"),
    practitionerFields: modelFields(schema, "Practitioner"),
    patientFields: modelFields(schema, "PatientRef"),
    guestFields: modelFields(schema, "Guest"),
    staffRosterFields: modelFields(schema, "StaffRoster"),
  };
}

function scanOrchestratorCp() {
  const schemaPath = join(
    ROOT,
    "era-orchestrator/packages/database/prisma/schema.prisma",
  );
  const schema = existsSync(schemaPath) ? readFileSync(schemaPath, "utf8") : "";
  return {
    app: "era-orchestrator (cp workforce)",
    workforcePiiLeak: scanWorkforcePiiLeak(schema),
  };
}

function scanFinanceCore() {
  const schemaPath = join(ROOT, "era-finance-core/packages/database/prisma/schema.prisma");
  const schema = existsSync(schemaPath) ? readFileSync(schemaPath, "utf8") : "";
  const apiRoot = join(ROOT, "era-finance-core/apps/api/src");
  const files = walkRepo(apiRoot);
  const text = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const empServicePath = files.find((f) =>
    f.replace(/\\/g, "/").endsWith("hr/employees.service.ts"),
  );
  const empServiceText = empServicePath ? readFileSync(empServicePath, "utf8") : "";
  return {
    app: "era-finance-core",
    employeeHasCipher: schema.includes("finCodeCipher") && schema.includes("passportNumberCipher"),
    employeePlaintextName: (() => {
      const m = schema.match(/model Employee \{([^}]+)\}/s);
      return m ? /\b(firstName|finCode)\b/.test(m[1]) : false;
    })(),
    employeeGlobalPersonId: schema.includes("globalPersonId"),
    counterpartyGlobalPersonId: schema.includes("globalPersonId"),
    mdmClient: text.includes("OrchestratorMdmClientService") || text.includes("resolvePersonIdentity"),
    dataHubClient: text.includes("DataHubClientService"),
    staffProvisioning: text.includes("hr-staff-provisioning"),
    financeStaffPublisher: scanWorkforceV3Publisher(empServiceText),
  };
}

function scanBankCore() {
  const schemaPath = join(ROOT, "era-bank-core/packages/database/prisma/schema.prisma");
  const schema = existsSync(schemaPath) ? readFileSync(schemaPath, "utf8") : "";
  const apiRoot = join(ROOT, "era-bank-core/apps/api/src");
  const files = walkRepo(apiRoot);
  const text = files.map((f) => readFileSync(f, "utf8")).join("\n");
  const guestPlaintextFin = /\bfinCode\s/.test(schema) && !schema.includes("finCodeCipher");
  return {
    app: "era-bank-core",
    cifGlobalPersonIdOnly: schema.includes("globalPersonId") && !guestPlaintextFin,
    mdmClient: text.includes("MdmClient"),
    dataHubClient: text.includes("DataHubClient"),
  };
}

function scanOrchestrator() {
  const schemaPath = join(ROOT, "era-orchestrator/packages/mdm-database/prisma/schema.prisma");
  const schema = existsSync(schemaPath) ? readFileSync(schemaPath, "utf8") : "";
  return {
    app: "era-orchestrator (mdm)",
    globalNaturalPerson: schema.includes("GlobalNaturalPerson"),
    personIdentifier: schema.includes("PersonIdentifier"),
    globalLegalEntity: schema.includes("GlobalLegalEntity"),
  };
}

function collectIssues(satelliteScans) {
  const issues = [];

  for (const s of satelliteScans) {
    if (s.plaintextPii && s.hasGlobalPersonId) {
      issues.push(
        createIssue({
          app: s.app,
          code: "PII_DUPLICATE",
          domain: "MDM",
          message: "Prisma has plaintext fin/passport alongside globalPersonId (ADR violation)",
        }),
      );
    }
    if (s.guestIdentityColumns) {
      issues.push(
        createIssue({
          app: s.app,
          code: "GUEST_IDENTITY_COLUMNS",
          domain: "MDM",
          message: "Hotel Guest model still has nationalIdFin/passportNumber (W4 migration pending)",
        }),
      );
    }
    if (s.lookupOnlyFin) {
      issues.push(
        createIssue({
          app: s.app,
          code: "MDM_LOOKUP_ONLY",
          domain: "MDM",
          message: "Uses lookupGlobalPersonByFin without linkPersonIdentity in app code",
        }),
      );
    }
    if (s.dataHubDirect && s.app !== "era-data-hub") {
      issues.push(
        createIssue({
          app: s.app,
          code: "DATA_HUB_DIRECT",
          domain: "REFERENCE",
          message: "Industry app references data-hub directly (ERA_DATA_HUB_URL or /registry/v1)",
        }),
      );
    }
    if (s.financeCatalogHandoff && !["era-finance-core", "era-bank-core"].includes(s.app)) {
      issues.push(
        createIssue({
          app: s.app,
          code: "FINANCE_CATALOG_HANDOFF",
          domain: "REFERENCE",
          message:
            "Industry app references Finance API URL for catalog handoffs (use orchestrator gateway)",
        }),
      );
    }
    if (s.dataHubDirect && s.financeCatalogHandoff && INDUSTRY_SET.has(s.app)) {
      issues.push(
        createIssue({
          app: s.app,
          code: "DATA_HUB_MIXED",
          domain: "REFERENCE",
          message: "Industry app mixes direct hub access and Finance catalog handoff",
        }),
      );
    }
    if (
      INDUSTRY_SET.has(s.app) &&
      (s.dataHubDirect || s.financeCatalogHandoff) &&
      !s.usesPlatformCatalog
    ) {
      issues.push(
        createIssue({
          app: s.app,
          code: "PLATFORM_CATALOG_REQUIRED",
          domain: "REFERENCE",
          message: "Industry app needs platform-catalog gateway (W2) instead of legacy hub/finance paths",
        }),
      );
    }
    if (s.workforceDualPath) {
      issues.push(
        createIssue({
          app: s.app,
          code: "WORKFORCE_DUAL_PATH",
          domain: "WORKFORCE",
          message:
            "Clinic still exposes legacy hire path (local_master/finance_hr or practitioner POST create)",
        }),
      );
    }
    if (
      s.app === "era-clinic" &&
      s.practitionerFields.length > 0 &&
      !s.practitionerFinanceLink
    ) {
      issues.push(
        createIssue({
          app: s.app,
          code: "FINANCE_EMPLOYEE_ID_MISSING",
          domain: "WORKFORCE",
          message: "Clinic Practitioner schema missing financeEmployeeId (W3)",
        }),
      );
    }
  }

  const kitDrift = scanSatelliteKitHubDrift(join(ROOT, "packages/satellite-kit"));
  if (kitDrift) {
    issues.push(
      createIssue({
        app: "packages/satellite-kit",
        code: "DATA_HUB_DIRECT",
        domain: "REFERENCE",
        message: "satellite-kit calendar.client still points to data-hub (post-W2 drift)",
      }),
    );
  }

  const cp = scanOrchestratorCp();
  if (cp.workforcePiiLeak) {
    issues.push(
      createIssue({
        app: cp.app,
        code: "WORKFORCE_PII_LEAK",
        domain: "MDM",
        message: "CP WorkforceEmployment/Absence has forbidden plaintext PII columns",
      }),
    );
  }

  const finance = scanFinanceCore();
  if (finance.employeePlaintextName) {
    issues.push(
      createIssue({
        app: "era-finance-core",
        code: "PII_DUPLICATE",
        domain: "MDM",
        message: "Finance Employee still has plaintext fin/name columns (Plan D)",
      }),
    );
  }
  if (finance.financeStaffPublisher) {
    issues.push(
      createIssue({
        app: "era-finance-core",
        code: "WORKFORCE_V3_PUBLISHER",
        domain: "WORKFORCE",
        message: "Finance still emits STAFF_PROVISIONED from employee create (use CP WorkforceProvisionService)",
      }),
    );
  }

  for (const s of satelliteScans) {
    const schema = readPrismaSchema(s.app);
    if (s.app === "era-clinic" && staffModelHasForbiddenIdentifiers(schema, "Practitioner")) {
      issues.push(
        createIssue({
          app: s.app,
          code: "STAFF_IDENTIFIER_COLUMNS",
          domain: "MDM",
          message: "Practitioner has forbidden identifier columns (T3 ops cache only)",
        }),
      );
    }
    if (s.app === "era-clinic" && staffModelHasForbiddenIdentifiers(schema, "User")) {
      issues.push(
        createIssue({
          app: s.app,
          code: "STAFF_IDENTIFIER_COLUMNS",
          domain: "MDM",
          message: "User has forbidden identifier columns (T3 ops cache only)",
        }),
      );
    }
  }

  return issues;
}

/** @param {{ domainFilter?: string }} [opts] */
export function runDataModelAudit(opts = {}) {
  const satelliteScans = listEraApps()
    .filter((a) => !["era-data-hub", "era-orchestrator", "era-finance-core", "era-bank-core"].includes(a))
    .map(scanApp);

  let issues = collectIssues(satelliteScans);
  if (opts.domainFilter) {
    issues = issues.filter((i) => i.domain === opts.domainFilter);
  }

  return {
    auditId: "data-model",
    satellites: satelliteScans,
    finance: scanFinanceCore(),
    bankCore: scanBankCore(),
    orchestrator: scanOrchestrator(),
    issues,
  };
}

function main() {
  const domainFilter = process.argv.includes("--domain")
    ? process.argv[process.argv.indexOf("--domain") + 1]
    : undefined;
  const report = runDataModelAudit({ domainFilter });
  report.generatedAt = new Date().toISOString();

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Data model integration scan — ${report.issues.length} automated issue(s)\n`);
    for (const s of report.satellites) {
      console.log(
        `  ${s.app}: globalPersonId=${s.hasGlobalPersonId} plaintextPii=${s.plaintextPii} mdmLink=${s.linkPersonIdentity} hubCalendar=${s.dataHubDirect} financeCatalogHandoff=${s.financeCatalogHandoff} workforceGuard=${!s.workforceDualPath}`,
      );
    }
    console.log("");
    for (const i of report.issues) {
      console.log(`  [${i.code}] ${i.app}: ${i.message}`);
    }
  }
  process.exitCode = report.issues.length > 0 ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main();
}
