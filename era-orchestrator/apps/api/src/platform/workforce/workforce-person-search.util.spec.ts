/**
 * Shared person-search unit tests (no Prisma).
 */
import {
  ageBucketFromBirth,
  isWorkforceFinQuery,
  personMatchesNameQuery,
  personMatchesSexAge,
} from "./workforce-person-search.util";

describe("workforce-person-search.util", () => {
  it("detects AZ FIN shape (no I/O)", () => {
    expect(isWorkforceFinQuery("1A2B3C4")).toBe(true);
    expect(isWorkforceFinQuery("1a2b3c4")).toBe(true);
    expect(isWorkforceFinQuery("1I2B3C4")).toBe(false);
    expect(isWorkforceFinQuery("ivan")).toBe(false);
    expect(isWorkforceFinQuery("1****C4")).toBe(false);
  });

  it("matches name parts, not UUID", () => {
    const p = {
      displayName: "Səxavət Əmirov",
      firstName: "Səxavət",
      lastName: "Əmirov",
      middleName: null,
    };
    expect(personMatchesNameQuery(p, "əmirov")).toBe(true);
    expect(personMatchesNameQuery(p, "səxa")).toBe(true);
    expect(
      personMatchesNameQuery(p, "dddddddd-dddd-4ddd-8ddd-dddddddddddd"),
    ).toBe(false);
  });

  it("sex/age filters", () => {
    const p = { sex: "MALE", birthDate: "1990-06-15" };
    expect(personMatchesSexAge(p, "MALE")).toBe(true);
    expect(personMatchesSexAge(p, "FEMALE")).toBe(false);
    const bucket = ageBucketFromBirth("1990-06-15");
    expect(bucket).toBeTruthy();
    expect(personMatchesSexAge(p, undefined, bucket!)).toBe(true);
    expect(personMatchesSexAge(p, undefined, "18-25")).toBe(false);
  });
});
