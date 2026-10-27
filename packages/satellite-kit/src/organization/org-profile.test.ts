import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { OrganizationProfileSnapshot } from "@era/contracts";
import { projectOrgPrintKeys, resolvePrintContacts } from "./org-profile";

function snap(
  partial: Partial<OrganizationProfileSnapshot> & { legalName: string },
): OrganizationProfileSnapshot {
  return {
    organizationId: "11111111-1111-1111-1111-111111111111",
    currency: "AZN",
    contacts: [],
    addresses: [],
    print: {
      "org.name": partial.legalName,
      "org.taxId": "",
      "org.legalAddress": "",
      "org.logoUrl": "",
      "org.bankLine": "",
      "org.phone": "",
      "org.email": "",
      "org.website": "",
    },
    ...partial,
  };
}

describe("projectOrgPrintKeys", () => {
  it("picks primary PHONE over secondary", () => {
    const keys = projectOrgPrintKeys(
      snap({
        legalName: "Nafta LLC",
        contacts: [
          {
            kind: "PHONE",
            value: "+994121111111",
            purpose: "GENERAL",
            isPrimary: false,
            sortOrder: 0,
          },
          {
            kind: "PHONE",
            value: "+994501111111",
            purpose: "PRINT",
            isPrimary: true,
            sortOrder: 1,
          },
        ],
      }),
      "en",
    );
    assert.equal(keys["org.phone"], "+994501111111");
    assert.equal(keys["org.name"], "Nafta LLC");
  });
});

describe("resolvePrintContacts", () => {
  it("outlet phone overlays org phone", () => {
    const out = resolvePrintContacts({
      org: snap({
        legalName: "Nafta LLC",
        contacts: [
          {
            kind: "PHONE",
            value: "+994121111111",
            purpose: "GENERAL",
            isPrimary: true,
            sortOrder: 0,
          },
        ],
      }),
      outlet: { phone: "+994551111111", name: "Bar Yasamal" },
    });
    assert.equal(out.phone, "+994551111111");
    assert.equal(out.name, "Bar Yasamal");
  });

  it("falls back to org when outlet empty", () => {
    const out = resolvePrintContacts({
      org: snap({
        legalName: "Clinic Dept",
        contacts: [
          {
            kind: "PHONE",
            value: "+994501234567",
            purpose: "GENERAL",
            isPrimary: true,
            sortOrder: 0,
          },
        ],
      }),
      outlet: { phone: null },
    });
    assert.equal(out.phone, "+994501234567");
    assert.equal(out.name, "Clinic Dept");
  });
});
