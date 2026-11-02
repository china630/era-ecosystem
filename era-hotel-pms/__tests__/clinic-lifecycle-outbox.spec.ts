import {
  clinicLifecycleDedupeKey,
  clinicLifecyclePayloadChanged,
} from "@/lib/integration/clinic-lifecycle-key";

describe("clinic lifecycle outbox", () => {
  it("keeps one row per stay guest and operation", () => {
    expect(
      clinicLifecycleDedupeKey({
        kind: "CHECK_IN",
        reservationId: "stay-1",
        paxKey: "pax-1",
      }),
    ).toBe("CHECK_IN:stay-1:pax-1");
    expect(
      clinicLifecycleDedupeKey({ kind: "CHECK_OUT", reservationId: "stay-1" }),
    ).toBe("CHECK_OUT:stay-1:");
  });

  it("treats the same payload as unchanged so an ack is kept", () => {
    const payload = { type: "SATELLITE_HOTEL_GUEST_CHECKED_IN", payload: { programCode: "PKG-STANDART" } };
    expect(clinicLifecyclePayloadChanged(payload, { ...payload })).toBe(false);
    expect(
      clinicLifecyclePayloadChanged(payload, {
        ...payload,
        payload: { programCode: "PKG-DERMA" },
      }),
    ).toBe(true);
  });
});
