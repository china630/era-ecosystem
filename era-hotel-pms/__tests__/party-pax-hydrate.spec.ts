import { emptyPax, hydratePaxNames } from "@/components/reservation-card/party-pax";

describe("hydratePaxNames", () => {
  it("fills companion names from linked Guest map, not the booker", () => {
    const rows = [
      emptyPax({ guestId: "g-mahir", isPrimary: true }),
      emptyPax({ guestId: "g-gulduze" }),
    ];
    const out = hydratePaxNames(
      rows,
      { id: "g-mahir", fullName: "Mahir Asadov" },
      new Map([["g-gulduze", "Gulduze Asadova"]]),
    );
    expect(out[0]).toMatchObject({ firstName: "Mahir", lastName: "Asadov" });
    expect(out[1]).toMatchObject({ firstName: "Gulduze", lastName: "Asadova" });
  });
});
