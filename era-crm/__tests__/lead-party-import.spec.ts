import {
  validatePartyForStage,
  normalizeAzPhone,
  buildConvertPartyPayload,
  syncContactRef,
} from "../src/lib/lead-party";
import { mapHeaders, mapRowToImport, parseCsvText } from "../src/lib/lead-import";

describe("lead-party", () => {
  it("requires VÖEN for LEGAL_ENTITY at QUALIFIED", () => {
    const err = validatePartyForStage(
      {
        partyKind: "LEGAL_ENTITY",
        taxId: null,
        companyName: "Test MMC",
        contactPhone: null,
        stage: "NEW",
      },
      "QUALIFIED",
    );
    expect(err).toMatch(/VÖEN/);
  });

  it("requires phone for INDIVIDUAL at QUALIFIED", () => {
    const err = validatePartyForStage(
      {
        partyKind: "INDIVIDUAL",
        taxId: null,
        companyName: null,
        contactPhone: null,
        stage: "NEW",
      },
      "QUALIFIED",
    );
    expect(err).toMatch(/phone/i);
  });

  it("normalizes AZ phone", () => {
    expect(normalizeAzPhone("501234567")).toBe("+994501234567");
  });

  it("syncs contactRef from phone", () => {
    expect(syncContactRef(undefined, "501234567", "phone")).toBe("+994501234567");
  });

  it("builds convert payload with party fields", () => {
    const payload = buildConvertPartyPayload({
      id: "l1",
      organizationId: "demo-org",
      partyKind: "LEGAL_ENTITY",
      taxId: "1234567890",
      companyName: "Test MMC",
      contactPhone: null,
      contactEmail: null,
      globalPersonId: null,
      activitySector: "hotels",
      prospectType: "PARTNER",
      stage: "WON",
      title: "Test",
      contactRef: "+994501234567",
      channel: "phone",
      estimatedAmount: null,
      counterpartyId: null,
      ownerId: null,
      nextContactAt: null,
      score: 0,
      scoreUpdatedAt: null,
      addressLabel: null,
      sourceRef: null,
      importBatchId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      convertedAt: null,
    });
    expect(payload.taxId).toBe("1234567890");
    expect(payload.prospectType).toBe("PARTNER");
  });
});

describe("lead-import", () => {
  it("maps e-taxes CSV headers", () => {
    const headers = ["voen", "tax_name", "donor_phones", "donor_sectors"];
    const idx = mapHeaders(headers);
    expect(idx.voen).toBe(0);
    expect(idx.tax_name).toBe(1);
  });

  it("maps row to legal entity lead", () => {
    const idx = mapHeaders(["voen", "tax_name", "donor_phones", "donor_sectors"]);
    const row = mapRowToImport(
      ["1234567890", "Test MMC", "+994501234567", "hotels"],
      idx,
      2,
    );
    expect("error" in row).toBe(false);
    if (!("error" in row)) {
      expect(row.partyKind).toBe("LEGAL_ENTITY");
      expect(row.taxId).toBe("1234567890");
      expect(row.activitySector).toBe("hotels");
    }
  });

  it("parses simple CSV", () => {
    const rows = parseCsvText("a,b\n1,2");
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual(["1", "2"]);
  });
});
