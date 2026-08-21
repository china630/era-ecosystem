import { licenseProvisionPlan, shiftLicenseDate } from "./license-defaults";

describe("licenseProvisionPlan", () => {
  const signup = new Date("2026-08-17T10:00:00.000Z");

  it("SHARED uses system trial days", () => {
    const plan = licenseProvisionPlan("SHARED", signup, 90);
    expect(plan.isTrial).toBe(true);
    expect(plan.expiresAt).not.toBeNull();
    expect(plan.expiresAt!.getTime()).toBeGreaterThan(signup.getTime());
  });

  it("DEDICATED has no trial and no expiry", () => {
    expect(licenseProvisionPlan("DEDICATED", signup, 90)).toEqual({
      isTrial: false,
      expiresAt: null,
    });
  });

  it("ONPREM has no trial and no expiry", () => {
    expect(licenseProvisionPlan("ONPREM", signup, 30)).toEqual({
      isTrial: false,
      expiresAt: null,
    });
  });
});

describe("shiftLicenseDate", () => {
  const now = new Date("2026-08-17T12:00:00.000Z");

  it("extends a future date", () => {
    const current = new Date("2026-09-30T23:59:59.000Z");
    const next = shiftLicenseDate(current, 1, now);
    expect(next.toISOString()).toBe("2026-10-30T23:59:59.000Z");
  });

  it("shrinks a future date", () => {
    const current = new Date("2026-10-17T12:00:00.000Z");
    const next = shiftLicenseDate(current, -1, now);
    expect(next.toISOString()).toBe("2026-09-17T12:00:00.000Z");
  });

  it("uses now when current is missing or past", () => {
    const past = new Date("2026-01-01T00:00:00.000Z");
    const fromNull = shiftLicenseDate(null, 1, now);
    const fromPast = shiftLicenseDate(past, 1, now);
    expect(fromNull.toISOString()).toBe("2026-09-17T12:00:00.000Z");
    expect(fromPast.toISOString()).toBe("2026-09-17T12:00:00.000Z");
  });
});
