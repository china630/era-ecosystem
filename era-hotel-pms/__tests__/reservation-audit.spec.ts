import {
  diffReservationSnapshots,
  journalActionGroup,
  parseAuditFieldKey,
  parseReservationAuditChanges,
  sectionForField,
  snapshotReservation,
  summarizeReservationAudit,
} from "@/lib/reservation-audit";

describe("reservation-audit", () => {
  it("ignores totals and timestamps in the snapshot", () => {
    const snap = snapshotReservation({
      status: "CONFIRMED",
      totalAmount: 120,
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      createdAt: new Date("2026-01-01T00:00:00Z"),
      pricingBusinessDate: "2026-01-01",
      ratePlan: { code: "BAR" },
    } as never);
    expect(snap.fields.some((row) => row.key === "totalAmount")).toBe(false);
    expect(snap.fields.some((row) => row.key === "updatedAt")).toBe(false);
    expect(snap.fields.find((row) => row.key === "ratePlan")?.value).toBe("BAR");
  });

  it("diffs labeled fields and keeps guest identity when order changes", () => {
    const before = snapshotReservation({
      status: "CONFIRMED",
      room: { roomNumber: "101" },
      paxGuests: [
        { guestId: "g1", firstName: "Ada", lastName: "Lovelace", isPrimary: true },
        { guestId: "g2", firstName: "Alan", lastName: "Turing", isPrimary: false },
      ],
    });
    const after = snapshotReservation({
      status: "IN_HOUSE",
      room: { roomNumber: "202" },
      paxGuests: [
        { guestId: "g2", firstName: "Alan", lastName: "Turing", isPrimary: false },
        { guestId: "g1", firstName: "Ada", lastName: "Lovelace", isPrimary: true },
      ],
    });
    const diff = diffReservationSnapshots(before, after);
    expect(diff.some((row) => row.key === "status" && row.from === "CONFIRMED" && row.to === "IN_HOUSE")).toBe(true);
    expect(diff.some((row) => row.key === "roomNumber" && row.from === "101" && row.to === "202")).toBe(true);
    expect(diff.some((row) => row.key.startsWith("guest.g1"))).toBe(false);
  });

  it("maps sections and summarizes a short line", () => {
    expect(sectionForField("status")).toBe("status");
    expect(sectionForField("guest.g1.package")).toBe("guests");
    expect(sectionForField("note.RES_NOTE")).toBe("notes");
    expect(sectionForField("night.2026-01-01.amount")).toBe("nights");
    expect(sectionForField("ratePlan")).toBe("card");
    const summary = summarizeReservationAudit("UPDATE", [
      { key: "roomNumber", from: "101", to: "202" },
    ]);
    expect(summary).toContain("room:");
    expect(summary).toContain("101");
    expect(summarizeReservationAudit("CREATE", [
      { key: "guestCount", from: null, to: "2" },
    ])).toBe("CREATE");
    expect(parseAuditFieldKey("guest.abc.name")).toEqual({
      kind: "guest",
      guestId: "abc",
      attr: "name",
    });
    expect(parseAuditFieldKey("night.2026-10-18.amount")).toEqual({
      kind: "night",
      ymd: "2026-10-18",
      attr: "amount",
    });
    expect(journalActionGroup("RELOCATE")).toBe("room");
    expect(journalActionGroup("PAYMENT")).toBe("money");
  });

  it("parses new payloads and legacy scalar diffs", () => {
    const modern = parseReservationAuditChanges({
      section: "folio",
      source: "night_audit",
      summary: "CHARGE",
      fields: [{ key: "amount", from: null, to: "40" }],
    });
    expect(modern.section).toBe("folio");
    expect(modern.source).toBe("night_audit");
    expect(modern.fields[0]?.to).toBe("40");

    const legacy = parseReservationAuditChanges({
      fields: { roomId: { from: "a", to: "b" } },
      amount: 12,
    });
    expect(legacy.fields.some((row) => row.key === "roomId" && row.to === "b")).toBe(true);

    const sparse = parseReservationAuditChanges({ amount: 8, paymentMethod: "CASH" });
    expect(sparse.section).toBe("folio");
    expect(sparse.fields.map((row) => row.key)).toEqual(["amount", "paymentMethod"]);
  });
});