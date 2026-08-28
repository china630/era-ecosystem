import { mergeFullNameWithPatronymic } from "./mdm-person-name";
import {
  normalizePersonSex,
  parsePersonBirthDate,
  personCoreDemographicsWrite,
} from "./mdm-person-sex";

describe("MDM person core sex + birthDate", () => {
  it("maps M/F and AZ labels; OTHER becomes UNKNOWN; no third legal sex", () => {
    expect(normalizePersonSex("M")).toBe("MALE");
    expect(normalizePersonSex("female")).toBe("FEMALE");
    expect(normalizePersonSex("kisi")).toBe("MALE");
    expect(normalizePersonSex("qadin")).toBe("FEMALE");
    expect(normalizePersonSex("kişi")).toBe("MALE");
    expect(normalizePersonSex("qadın")).toBe("FEMALE");
    expect(normalizePersonSex("OTHER")).toBe("UNKNOWN");
    expect(normalizePersonSex("X")).toBe("UNKNOWN");
    expect(normalizePersonSex("")).toBeUndefined();
  });

  it("parses calendar birth dates", () => {
    expect(parsePersonBirthDate("1988-03-15")?.toISOString().slice(0, 10)).toBe(
      "1988-03-15",
    );
    expect(parsePersonBirthDate("not-a-date")).toBeUndefined();
  });

  it("fill-not-clear: known sex is not overwritten by UNKNOWN; empty DOB does not wipe", () => {
    expect(
      personCoreDemographicsWrite({
        sex: "UNKNOWN",
        existingSex: "MALE",
      }).sex,
    ).toBeUndefined();
    expect(
      personCoreDemographicsWrite({
        gender: "F",
        existingSex: "MALE",
      }).sex,
    ).toBe("FEMALE");
    expect(
      personCoreDemographicsWrite({
        birthDate: "",
        existingSex: "FEMALE",
      }).birthDate,
    ).toBeUndefined();
    expect(
      personCoreDemographicsWrite({
        birthDate: "1991-01-02",
      }).birthDate?.toISOString().slice(0, 10),
    ).toBe("1991-01-02");
  });

  it("fills patronymic into MDM fullName and does not shrink", () => {
    expect(mergeFullNameWithPatronymic("Ali Mammadov", "Ali Vali Mammadov")).toBe(
      "Ali Vali Mammadov",
    );
    expect(mergeFullNameWithPatronymic("Ali Vali Mammadov", "Ali Mammadov")).toBe(
      "Ali Vali Mammadov",
    );
  });
});
