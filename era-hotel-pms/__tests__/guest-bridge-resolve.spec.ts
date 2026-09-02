import {
  guestDisplayNameFromRow,
  isBridgeGuestStubRef,
} from "@/lib/integration/elektraweb-bridge/guest-bridge-resolve";

describe("bridge guest resolve helpers", () => {
  it("treats import stubs and empty refs as backfillable", () => {
    expect(isBridgeGuestStubRef(null)).toBe(true);
    expect(isBridgeGuestStubRef("")).toBe(true);
    expect(isBridgeGuestStubRef("import-guest-res:96643236")).toBe(true);
    expect(isBridgeGuestStubRef("ew-fo-name:elvira raxmanova")).toBe(true);
    expect(isBridgeGuestStubRef("118073532")).toBe(false);
    expect(isBridgeGuestStubRef("wo:fo:9001")).toBe(false);
  });

  it("prefers GUESTNAMES on FOCP rows", () => {
    expect(
      guestDisplayNameFromRow({
        GUESTNAMES: "Elvira Raxmanova",
        NAME: "Elvira",
        LNAME: "Raxmanova",
      }),
    ).toBe("Elvira Raxmanova");
  });

  it("joins NAME + LNAME when GUESTNAMES is empty", () => {
    expect(
      guestDisplayNameFromRow({
        NAME: "Elvira",
        LNAME: "Raxmanova",
      }),
    ).toBe("Elvira Raxmanova");
  });
});
