import {
  occupancyFitsGenderWindow,
  resolveGenderSession,
  genderTintForHour,
  type GenderSessionTenantInput,
} from "@/domain/procedure/gender-session";

const tenant: GenderSessionTenantInput = {
  genderSessionMode: "SPLIT_BY_LUNCH",
  genderSessionFemaleFirst: true,
  genderSessionUnknown: "BLOCK",
  dayStartHour: 8,
  dayEndHour: 18,
  lunchStartHour: 13,
  lunchEndHour: 14,
};

describe("gender session windows (CLI-48)", () => {
  it("OFF type ignores tenant split", () => {
    const resolved = resolveGenderSession(tenant, { genderSessionPolicy: "OFF" });
    expect(resolved.active).toBe(false);
    const start = new Date("2026-08-23T09:00:00");
    const end = new Date("2026-08-23T09:20:00");
    expect(
      occupancyFitsGenderWindow({ resolved, sex: "MALE", startsAt: start, endsAt: end }),
    ).toBe(true);
  });

  it("SPLIT_BY_LUNCH: female AM ok, male AM skip, straddle fail", () => {
    const resolved = resolveGenderSession(tenant, { genderSessionPolicy: "SPLIT_BY_LUNCH" });
    const amStart = new Date("2026-08-23T09:00:00");
    const amEnd = new Date("2026-08-23T09:20:00");
    const pmStart = new Date("2026-08-23T14:00:00");
    const pmEnd = new Date("2026-08-23T14:20:00");
    const straddleStart = new Date("2026-08-23T12:50:00");
    const straddleEnd = new Date("2026-08-23T13:10:00");
    expect(occupancyFitsGenderWindow({ resolved, sex: "FEMALE", startsAt: amStart, endsAt: amEnd })).toBe(true);
    expect(occupancyFitsGenderWindow({ resolved, sex: "MALE", startsAt: amStart, endsAt: amEnd })).toBe(false);
    expect(occupancyFitsGenderWindow({ resolved, sex: "MALE", startsAt: pmStart, endsAt: pmEnd })).toBe(true);
    expect(occupancyFitsGenderWindow({ resolved, sex: "FEMALE", startsAt: pmStart, endsAt: pmEnd })).toBe(false);
    expect(
      occupancyFitsGenderWindow({
        resolved,
        sex: "FEMALE",
        startsAt: straddleStart,
        endsAt: straddleEnd,
      }),
    ).toBe(false);
  });

  it("UNKNOWN is blocked by default", () => {
    const resolved = resolveGenderSession(tenant, { genderSessionPolicy: "INHERIT" });
    const start = new Date("2026-08-23T09:00:00");
    const end = new Date("2026-08-23T09:20:00");
    expect(occupancyFitsGenderWindow({ resolved, sex: "UNKNOWN", startsAt: start, endsAt: end })).toBe(
      false,
    );
    expect(occupancyFitsGenderWindow({ resolved, sex: "OTHER", startsAt: start, endsAt: end })).toBe(
      false,
    );
  });

  it("INHERIT OFF tenant is inactive", () => {
    const resolved = resolveGenderSession(
      { ...tenant, genderSessionMode: "OFF" },
      { genderSessionPolicy: "INHERIT" },
    );
    expect(resolved.active).toBe(false);
  });

  it("tints AM female when femaleFirst", () => {
    const resolved = resolveGenderSession(tenant, { genderSessionPolicy: "SPLIT_BY_LUNCH" });
    expect(genderTintForHour(resolved, 10)).toBe("female");
    expect(genderTintForHour(resolved, 15)).toBe("male");
    expect(genderTintForHour(resolved, 13)).toBeNull();
  });
});
