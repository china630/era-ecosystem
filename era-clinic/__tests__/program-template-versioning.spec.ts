import {
  compositionChanged,
  contractMetaChanged,
  buildEntitlementSnapshot,
  membersMapFromSnapshot,
  parseEntitlementSnapshot,
  resolveMembersByBlock,
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
