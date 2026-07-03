import { readFileSync } from "node:fs";
import { join } from "node:path";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  scanWorkforceDualPath,
  scanWorkforcePiiLeak,
  scanWorkforceV3Publisher,
} from "../audit-lib.mjs";

const ROOT = join(import.meta.dirname, "..", "..");

describe("v3 workforce cutover audit rules", () => {
  it("clinic practitioners POST blocks local create", () => {
    const routePath = join(ROOT, "era-clinic/app/api/admin/practitioners/route.ts");
    const text = readFileSync(routePath, "utf8");
    assert.ok(text.includes("WORKFORCE_HIRE_VIA_CP"));
    assert.ok(!text.includes("createPractitionerLocalMaster"));
  });

  it("scanWorkforceDualPath passes for era-clinic", () => {
    const clinicRoot = join(ROOT, "era-clinic");
    const tsFiles = [
      join(clinicRoot, "app/api/admin/practitioners/route.ts"),
      join(clinicRoot, "src/lib/workforce-policy.ts"),
    ];
    const allText = tsFiles.map((f) => readFileSync(f, "utf8")).join("\n");
    assert.equal(scanWorkforceDualPath("era-clinic", tsFiles, allText), false);
  });

  it("Finance employees.service does not emit STAFF_PROVISIONED", () => {
    const empPath = join(ROOT, "era-finance-core/apps/api/src/hr/employees.service.ts");
    const text = readFileSync(empPath, "utf8");
    assert.equal(scanWorkforceV3Publisher(text), false);
  });

  it("orchestrator CP workforce schema has no PII leak on Employment", () => {
    const schemaPath = join(ROOT, "era-orchestrator/packages/database/prisma/schema.prisma");
    const schema = readFileSync(schemaPath, "utf8");
    assert.equal(scanWorkforcePiiLeak(schema), false);
  });

  it("legacy hire mode strings absent from clinic workforce policy", () => {
    const text = readFileSync(join(ROOT, "era-clinic/src/lib/workforce-policy.ts"), "utf8");
    assert.ok(!/finance_hr|local_master|isFinanceHrHireMode/.test(text));
  });
});
