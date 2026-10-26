import { paxLifecycleGlobalPersonId } from "@/lib/integration/pax-lifecycle-person";

const primary = { id: "guest-primary", globalPersonId: "gp-gulnara" };

describe("paxLifecycleGlobalPersonId", () => {
  it("does not give the primary MDM id to a companion who has none", () => {
    expect(
      paxLifecycleGlobalPersonId({
        isPrimary: false,
        guestId: "guest-child",
        guest: { id: "guest-child", globalPersonId: null },
        primaryGuest: primary,
      }),
    ).toBeUndefined();
  });

  it("keeps a companion's own MDM id", () => {
    expect(
      paxLifecycleGlobalPersonId({
        isPrimary: false,
        guestId: "guest-child",
        guest: { id: "guest-child", globalPersonId: "gp-suleyman" },
        primaryGuest: primary,
      }),
    ).toBe("gp-suleyman");
  });

  it("uses the stay guest id when the primary row itself has none on the link", () => {
    expect(
      paxLifecycleGlobalPersonId({
        isPrimary: true,
        guestId: "guest-primary",
        guest: { id: "guest-primary", globalPersonId: null },
        primaryGuest: primary,
      }),
    ).toBe("gp-gulnara");
  });

  it("treats a single unnamed pax row that is the stay guest as primary", () => {
    expect(
      paxLifecycleGlobalPersonId({
        guest: primary,
        primaryGuest: primary,
      }),
    ).toBe("gp-gulnara");
  });
});
