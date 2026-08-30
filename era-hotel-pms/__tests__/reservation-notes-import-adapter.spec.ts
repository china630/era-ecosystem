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

  it("expands wide FO-with-Notes columns including COut/Room/Cancel/Payment/Invoice", () => {
    const row = reservationNotesAdapter.mapRow({
      externalRef: "55",
      extraReq: "ERA-PKG PREMIUM",
      resNote: "vip",
      coutNote: "left key",
      roomNote: "high floor",
      cancelNote: "",
      paymentNote: "cash",
      priceNote: "2*289 AZN",
      invoiceNote: "VOEN",
    });
    expect(row).toMatchObject({ externalRef: "55", noteType: "__WIDE__" });
    const bag = JSON.parse((row as { text: string }).text);
    expect(bag.EXTRA_REQ).toBe("ERA-PKG PREMIUM");
    expect(bag.RES_NOTE).toBe("vip");
    expect(bag.COUT_NOTE).toBe("left key");
    expect(bag.ROOM_NOTE).toBe("high floor");
    expect(bag.PAYMENT_NOTE).toBe("cash");
    expect(bag.PRICE_NOTE).toBe("2*289 AZN");
    expect(bag.INVOICE_NOTE).toBe("VOEN");
  });

  it("maps #COut Note# alias to COUT_NOTE in long dump", () => {
    const mapped = mapHeaders(
      {
        "Note Type": "#COut Note#",
        Notes: "taxi",
        "Res Id": "77",
      },
      reservationNotesAdapter.headerAliases,
    );
    // Note Type alias not in headerAliases — mapRow uses noteType raw
    const row = reservationNotesAdapter.mapRow({
      noteType: "#COut Note#",
      text: "taxi",
      externalRef: "77",
    });
    expect(row).toMatchObject({ externalRef: "77", noteType: "COUT_NOTE", text: "taxi" });
    void mapped;
  });
});
