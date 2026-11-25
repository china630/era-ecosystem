/**
 * AC-CON-TENANT — SHARED is the product default; ops queries rely on kit tenant extension.
 */
import { describe, expect, it } from "@jest/globals";
import fs from "node:fs";
import path from "node:path";

describe("AC-CON-TENANT SHARED default", () => {
  it("prisma client wires satellite tenant extension", () => {
    const src = fs.readFileSync(
      path.join(__dirname, "../src/lib/prisma.ts"),
      "utf8",
    );
    expect(src).toContain("createSatelliteTenantExtension");
    expect(src).toContain("asSatellitePrisma");
  });

  it("Project model carries organizationId", () => {
    const schema = fs.readFileSync(
      path.join(__dirname, "../prisma/schema.prisma"),
      "utf8",
    );
    expect(schema).toMatch(/model Project[\s\S]*?organizationId/);
    expect(schema).toMatch(/@@unique\(\[organizationId,\s*code\]\)/);
  });
});
