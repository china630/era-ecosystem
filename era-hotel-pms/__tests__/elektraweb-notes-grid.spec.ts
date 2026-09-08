import { mapNoteType } from "@/lib/import/adapters/reservation-notes.adapter";
import { planElektrawebNotesRow } from "@/lib/integration/elektraweb-bridge/upsert-reservation-note";

describe("elektraweb QA_EASYPMS_NOTES long rows", () => {
  it("maps Extra Request ERA-PKG to EXTRA_REQ", () => {
    expect(mapNoteType("Extra Request")).toBe("EXTRA_REQ");
    expect(
      planElektrawebNotesRow({
        RESID: 96643236,
        NOTETYPE: "Extra Request",
        NOTETYPEID: 1001,
        NOTES: "ERA-PKG DERMO",
      }),
    ).toEqual({
      externalRef: "96643236",
      noteType: "EXTRA_REQ",
      text: "ERA-PKG DERMO",
    });
  });

  it("maps Price Note and skips Channel", () => {
    expect(
      planElektrawebNotesRow({
        RESID: "96643236",
        NOTETYPE: "Price Note",
        NOTES: "  14*180 AZN ",
      }),
    ).toMatchObject({ noteType: "PRICE_NOTE", text: "14*180 AZN" });

    expect(
      planElektrawebNotesRow({
        RESID: 96456617,
        NOTETYPE: "Channel",
        NOTES: "Customer // Name: x",
      }),
    ).toMatchObject({ skip: "channel-noise" });
  });
});
