import { reservationNotesAdapter } from "@/lib/import/adapters/reservation-notes.adapter";
import { mapHeaders } from "@/lib/import/helpers";

describe("reservation-notes import adapter", () => {
  it("maps Notes dump Note Type + Res Id", () => {
    const mapped = mapHeaders(
      {
        "Note Type": "Extra Request",
        Notes: "ERA-PKG STANDART",
        "Res Id": "12345",
      },
      reservationNotesAdapter.headerAliases,
    );
    const row = reservationNotesAdapter.mapRow(mapped);
    expect(row).toMatchObject({
      externalRef: "12345",
      noteType: "EXTRA_REQ",
      text: "ERA-PKG STANDART",
    });
  });

  it("parses Res Id from Reservation Info", () => {
    const row = reservationNotesAdapter.mapRow({
      noteType: "RES_NOTE",
      text: "hello",
      reservationInfo: "Res Id: 998877 Guest: X",
    });
    expect(row).toMatchObject({ externalRef: "998877", noteType: "RES_NOTE" });
  });

  it("skips empty identity", () => {
    expect(
      reservationNotesAdapter.mapRow({
        noteType: "EXTRA_REQ",
        text: "ERA-PKG STANDART",
      }),
    ).toBeNull();
  });

  it("expands wide FO-with-Notes columns", () => {
    const row = reservationNotesAdapter.mapRow({
      externalRef: "55",
      extraReq: "ERA-PKG PREMIUM",
      resNote: "vip",
    });
    expect(row).toMatchObject({ externalRef: "55", noteType: "__WIDE__" });
    const bag = JSON.parse((row as { text: string }).text);
    expect(bag.EXTRA_REQ).toBe("ERA-PKG PREMIUM");
    expect(bag.RES_NOTE).toBe("vip");
  });
});
