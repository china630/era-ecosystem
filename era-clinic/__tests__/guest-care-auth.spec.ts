import {
  assertGuestCareServiceToken,
  parseGuestCarePersonParams,
} from "../nest/guest-care-auth";

describe("guest-care-auth", () => {
  const prev = process.env.SATELLITE_EVENT_SERVICE_TOKEN;

  afterEach(() => {
    if (prev == null) delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    else process.env.SATELLITE_EVENT_SERVICE_TOKEN = prev;
  });

  it("rejects when service token env is missing", () => {
    delete process.env.SATELLITE_EVENT_SERVICE_TOKEN;
    expect(
      assertGuestCareServiceToken({
        headers: { authorization: "Bearer anything" },
      } as never),
    ).toBe(false);
  });

  it("rejects wrong bearer", () => {
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "expected-token";
    expect(
      assertGuestCareServiceToken({
        headers: { authorization: "Bearer other" },
      } as never),
    ).toBe(false);
  });

  it("accepts matching bearer", () => {
    process.env.SATELLITE_EVENT_SERVICE_TOKEN = "expected-token";
    expect(
      assertGuestCareServiceToken({
        headers: { authorization: "Bearer expected-token" },
      } as never),
    ).toBe(true);
  });

  it("requires both globalPersonId and organizationId", () => {
    expect(parseGuestCarePersonParams({ globalPersonId: "p1" })).toEqual({
      error: "missing_params",
    });
    expect(parseGuestCarePersonParams({ organizationId: "o1" })).toEqual({
      error: "missing_params",
    });
    expect(
      parseGuestCarePersonParams({ globalPersonId: "p1", organizationId: "o1" }),
    ).toEqual({ globalPersonId: "p1", organizationId: "o1" });
  });
});
