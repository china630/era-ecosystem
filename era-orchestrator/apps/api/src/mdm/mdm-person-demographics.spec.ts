import {
  composePersonFullName,
  splitFullNameToParts,
  mergePersonNameParts,
  normalizeNationalityIso,
  hasPersonNameInput,
  resolveIncomingNameParts,
  mergeFullNameWithPatronymic,
} from "./mdm-person-name";
import {
  normalizePersonSex,
  parsePersonBirthDate,
  personCoreDemographicsWrite,
} from "./mdm-person-sex";

describe("MDM person core sex + birthDate", () => {
  it("maps M/F and AZ labels; OTHER becomes UNKNOWN; no third legal sex", () => {
    expect(normalizePersonSex("K")).toBe("MALE");
    expect(normalizePersonSex("Q")).toBe("FEMALE");
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

  it("deprecated blob merge still does not shrink (compat)", () => {
    expect(mergeFullNameWithPatronymic("Ali Mammadov", "Ali Vali Mammadov")).toBe(
      "Ali Vali Mammadov",
    );
    expect(mergeFullNameWithPatronymic("Ali Vali Mammadov", "Ali Mammadov")).toBe(
      "Ali Vali Mammadov",
    );
  });
});

describe("MDM person name parts (SoR)", () => {
  it("splits 2/3 tokens and Ali Vali Mammadov", () => {
    expect(splitFullNameToParts("Ali Mammadov")).toEqual({
      firstName: "Ali",
      middleName: null,
      lastName: "Mammadov",
    });
    expect(splitFullNameToParts("Ali Vali Mammadov")).toEqual({
      firstName: "Ali",
      middleName: "Vali",
      lastName: "Mammadov",
    });
    expect(splitFullNameToParts("Ali Vali oglu Mammadov")).toEqual({
      firstName: "Ali",
      middleName: "Vali oglu",
      lastName: "Mammadov",
    });
    expect(splitFullNameToParts("Ali")).toEqual({
      firstName: "Ali",
      middleName: null,
      lastName: null,
    });
  });

  it("composes fullName skipping empty parts", () => {
    expect(composePersonFullName("Ali", "Vali", "Mammadov")).toBe(
      "Ali Vali Mammadov",
    );
    expect(composePersonFullName("Ali", null, "Mammadov")).toBe("Ali Mammadov");
    expect(composePersonFullName("Ali", "  ", "Mammadov")).toBe("Ali Mammadov");
  });

  it("fill-not-clear: shorter name does not wipe middleName", () => {
    const merged = mergePersonNameParts(
      {
        firstName: "Ali",
        middleName: "Vali",
        lastName: "Mammadov",
      },
      splitFullNameToParts("Ali Mammadov"),
    );
    expect(merged).toEqual({
      firstName: "Ali",
      middleName: "Vali",
      lastName: "Mammadov",
      fullName: "Ali Vali Mammadov",
    });
  });

  it("fill-not-clear: empty incoming parts do not clear existing", () => {
    const merged = mergePersonNameParts(
      {
        firstName: "Ali",
        middleName: "Vali",
        lastName: "Mammadov",
      },
      { firstName: "Ali", middleName: "", lastName: "Mammadov" },
    );
    expect(merged.middleName).toBe("Vali");
    expect(merged.fullName).toBe("Ali Vali Mammadov");
  });

  it("OTHER nationality is not written; KZ is stored upper-case", () => {
    expect(normalizeNationalityIso("OTHER")).toBeNull();
    expect(normalizeNationalityIso("русский")).toBeNull();
    expect(normalizeNationalityIso("kz")).toBe("KZ");
    expect(normalizeNationalityIso("AZ")).toBe("AZ");
  });

  it("create accepts firstName+lastName without fullName", () => {
    expect(
      hasPersonNameInput({ firstName: "Ali", lastName: "Mammadov" }),
    ).toBe(true);
    expect(hasPersonNameInput({ fullName: "Ali Mammadov" })).toBe(true);
    expect(hasPersonNameInput({ firstName: "Ali" })).toBe(false);
    const parts = resolveIncomingNameParts({
      firstName: "Ali",
      lastName: "Mammadov",
    });
    expect(parts).toEqual({
      firstName: "Ali",
      middleName: null,
      lastName: "Mammadov",
    });
    expect(composePersonFullName(parts!.firstName, parts!.middleName, parts!.lastName)).toBe(
      "Ali Mammadov",
    );
  });

  it("create with only fullName fills parts", () => {
    expect(resolveIncomingNameParts({ fullName: "Ali Vali Mammadov" })).toEqual({
      firstName: "Ali",
      middleName: "Vali",
      lastName: "Mammadov",
    });
  });
});
