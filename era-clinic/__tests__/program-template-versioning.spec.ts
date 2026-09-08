import {
  compositionChanged,
  contractMetaChanged,
  buildEntitlementSnapshot,
  dateOnlyString,
  isWithinValidity,
  membersMapFromSnapshot,
  parseDateOnly,
  parseEntitlementSnapshot,
  resolveMembersByBlock,
  validityChanged,
} from "@/domain/sanatorium/program-template-admin";

describe("program template versioning helpers", () => {
  const base = {
    procedures: [
      {
        procedureCode: "PHYSIO_POOL",
        procedureName: "Physio",
        quotaTotal: 27,
        kind: "PHYSIO" as const,
        sortOrder: 0,
      },
    ],
    quotaKnots: [{ nights: 10, procedureCode: "PHYSIO_POOL", qty: 27 }],
    blockMembers: [{ blockCode: "PHYSIO_POOL", procedureCode: "SVC-LASER" }],
  };

  it("compositionChanged is false when members/knots unchanged", () => {
    expect(
      compositionChanged(
        base,
        [
          {
            procedureCode: "PHYSIO_POOL",
            procedureName: "Physio",
            quotaTotal: 27,
            kind: "PHYSIO",
            sortOrder: 0,
            memberCodes: ["SVC-LASER"],
          },
        ],
        [{ nights: 10, procedureCode: "PHYSIO_POOL", qty: 27 }],
      ),
    ).toBe(false);
  });

  it("compositionChanged is true when membership grows", () => {
    expect(
      compositionChanged(
        base,
        [
          {
            procedureCode: "PHYSIO_POOL",
            procedureName: "Physio",
            quotaTotal: 27,
            kind: "PHYSIO",
            sortOrder: 0,
            memberCodes: ["SVC-LASER", "SVC-MAGNET"],
          },
        ],
        [{ nights: 10, procedureCode: "PHYSIO_POOL", qty: 27 }],
      ),
    ).toBe(true);
  });

  it("compositionChanged is true when block axes change", () => {
    expect(
      compositionChanged(
        {
          ...base,
          procedures: [
            {
              ...base.procedures[0],
              assignMode: "MANUAL",
              fulfillment: "PROCEDURE_ORDER",
              quotaBasis: "PER_NIGHTS",
              requiresDoctor: false,
            },
          ],
        },
        [
          {
            procedureCode: "PHYSIO_POOL",
            procedureName: "Physio",
            quotaTotal: 27,
            kind: "PHYSIO",
            sortOrder: 0,
            memberCodes: ["SVC-LASER"],
            assignMode: "AUTO_ON_OPEN",
            fulfillment: "PROCEDURE_ORDER",
            quotaBasis: "PER_NIGHTS",
            requiresDoctor: false,
          },
        ],
        [{ nights: 10, procedureCode: "PHYSIO_POOL", qty: 27 }],
      ),
    ).toBe(true);
  });

  it("snapshot includes block axes in fingerprint round-trip", () => {
    const snap = buildEntitlementSnapshot({
      templateId: "t1",
      code: "PKG-STANDART",
      version: 2,
      procedures: [
        {
          procedureCode: "ECG-12",
          procedureName: "ECG",
          quotaTotal: 1,
          kind: "LAB",
          sortOrder: 0,
          assignMode: "AUTO_ON_OPEN",
          fulfillment: "LAB_ORDER",
          quotaBasis: "PER_STAY",
          requiresDoctor: false,
        },
      ],
      knots: [{ nights: 10, procedureCode: "ECG-12", qty: 1 }],
      members: [],
    });
    expect(snap.procedures[0].assignMode).toBe("AUTO_ON_OPEN");
    expect(snap.procedures[0].fulfillment).toBe("LAB_ORDER");
    expect(snap.procedures[0].quotaBasis).toBe("PER_STAY");
  });

  it("contractMetaChanged detects name and nights window", () => {
    const existing = {
      name: "Standart",
      durationDays: 10,
      minNights: 7,
      maxNights: 21,
    };
    expect(contractMetaChanged(existing, {})).toBe(false);
    expect(contractMetaChanged(existing, { name: "Standart+" })).toBe(true);
    expect(contractMetaChanged(existing, { minNights: 5 })).toBe(true);
    expect(contractMetaChanged(existing, { maxNights: 21 })).toBe(false);
  });

  it("snapshot round-trip feeds membersMapFromSnapshot", () => {
    const snap = buildEntitlementSnapshot({
      templateId: "t1",
      code: "PKG-STANDART",
      version: 2,
      procedures: base.procedures,
      knots: base.quotaKnots,
      members: base.blockMembers,
    });
    const parsed = parseEntitlementSnapshot(snap);
    expect(parsed?.version).toBe(2);
    const map = membersMapFromSnapshot(parsed);
    expect(map.get("PHYSIO_POOL")).toEqual(["SVC-LASER"]);
  });

  it("resolveMembersByBlock prefers empty snapshot over live template members", () => {
    const snap = buildEntitlementSnapshot({
      templateId: "t1",
      code: "PKG-STANDART",
      version: 1,
      procedures: base.procedures,
      knots: base.quotaKnots,
      members: [],
    });
    const map = resolveMembersByBlock({
      entitlementSnapshot: snap,
      templateMembers: [{ blockCode: "PHYSIO_POOL", procedureCode: "SVC-LIVE" }],
    });
    expect(map.get("PHYSIO_POOL")).toBeUndefined();
    expect([...map.keys()]).toEqual([]);
  });
});

describe("program template validity window", () => {
  const day = (ymd: string) => parseDateOnly(ymd) as Date;

  it("treats blank and malformed dates as an open bound", () => {
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly("08.09.2026")).toBeNull();
    expect(dateOnlyString(day("2026-09-08"))).toBe("2026-09-08");
  });

  it("keeps legacy rows without bounds sellable", () => {
    expect(isWithinValidity({}, "2026-09-08")).toBe(true);
    expect(
      isWithinValidity({ effectiveFrom: day("2026-01-01"), effectiveTo: null }, "2026-09-08"),
    ).toBe(true);
  });

  it("includes both bounds and rejects outside days", () => {
    const row = { effectiveFrom: day("2026-09-08"), effectiveTo: day("2026-09-10") };
    expect(isWithinValidity(row, "2026-09-07")).toBe(false);
    expect(isWithinValidity(row, "2026-09-08")).toBe(true);
    expect(isWithinValidity(row, "2026-09-10")).toBe(true);
    expect(isWithinValidity(row, "2026-09-11")).toBe(false);
  });

  it("detects only real date moves (contract fields stay separate)", () => {
    const existing = { effectiveFrom: day("2026-09-08"), effectiveTo: null };
    expect(
      validityChanged(existing, { effectiveFrom: day("2026-09-08"), effectiveTo: null }),
    ).toBe(false);
    expect(
      validityChanged(existing, { effectiveFrom: day("2026-09-08"), effectiveTo: day("2026-12-31") }),
    ).toBe(true);
    expect(contractMetaChanged(
      { name: "Standart", durationDays: 10, minNights: 7, maxNights: 21 },
      {},
    )).toBe(false);
  });
});
