const {
  HEADERS,
  procedureCode,
  roomCode,
  slotStatus,
  isOpsSlotDate,
  mapRosterRow,
} = require("../scripts/nafta-cutover/map.cjs");

describe("nafta cutover column map", () => {
  it("exposes EN headers for clinic 01–10 and roster", () => {
    expect(HEADERS.procedures[0]).toBe("externalRef");
    expect(HEADERS.slots).toContain("status");
    expect(HEADERS.roster).toEqual([
      "fin",
      "fullName",
      "orgUnit",
      "position",
      "hireDate",
      "satellites",
    ]);
  });

  it("maps WO ids to stable external codes", () => {
    expect(procedureCode(10)).toBe("WO-TR-10");
    expect(roomCode(44)).toBe("WO-ROOM-44");
  });

  it("marks pre-cutover slots COMPLETED and ops week SCHEDULED", () => {
    expect(slotStatus("2026-08-24")).toBe("COMPLETED");
    expect(slotStatus("2026-08-25")).toBe("SCHEDULED");
    expect(isOpsSlotDate("2026-08-24")).toBe(true);
    expect(isOpsSlotDate("2026-09-01")).toBe(false);
  });

  it("maps medical job titles to clinic satellite", () => {
    const row = mapRosterRow({
      FİN: "4QK1E9C",
      "Tam adı": "Rəna Kəngərli",
      Şöbə: "Tibb",
      Vəzifə: "Baş həkim",
    });
    expect(row.satellites).toBe("industry_clinic");
    expect(row.fin).toBe("4QK1E9C");
  });
});
