import { pickStayGlobalPersonId } from "@/lib/services/stay-person-lookup.service";

describe("pickStayGlobalPersonId", () => {
  const stay = {
    guest: { globalPersonId: "gp-primary" },
    reservationGuests: [
      { sortOrder: 0, isPrimary: true, guest: { globalPersonId: "gp-pax-0" } },
      { sortOrder: 1, isPrimary: false, guest: { globalPersonId: "gp-pax-1" } },
    ],
  };

  it("prefers primary pax when folioPerson omitted", () => {
    expect(pickStayGlobalPersonId(stay, null)).toBe("gp-pax-0");
  });

  it("maps WO folioPerson 1 to first pax (0-based sortOrder)", () => {
    expect(pickStayGlobalPersonId(stay, 1)).toBe("gp-pax-0");
  });

  it("falls back to stay guest when share has no MDM", () => {
    expect(
      pickStayGlobalPersonId(
        {
          guest: { globalPersonId: "gp-stay" },
          reservationGuests: [{ sortOrder: 0, isPrimary: true, guest: { globalPersonId: null } }],
        },
        1,
      ),
    ).toBe("gp-stay");
  });
});
