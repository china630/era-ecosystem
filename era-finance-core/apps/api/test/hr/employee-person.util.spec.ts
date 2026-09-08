import {
  formatAzEmployeeListName,
  personDisplayFromOpsProfile,
} from "../../src/hr/employee-person.util";

describe("employee-person.util", () => {
  it("personDisplayFromOpsProfile uses MDM name parts (given-first canon)", () => {
    const p = personDisplayFromOpsProfile({
      displayName: "Ali Vali Mammadov",
      firstName: "Ali",
      middleName: "Vali",
      lastName: "Mammadov",
      primaryIdentifierMasked: "1****C4",
      accessDenied: false,
    });
    expect(p.firstName).toBe("Ali");
    expect(p.middleName).toBe("Vali");
    expect(p.lastName).toBe("Mammadov");
    expect(p.displayName).toBe("Ali Vali Mammadov");
    expect(p.finCode).toBe("1****C4");
  });

  it("fallback splitFullNameToParts is given-first, not AZ surname-first", () => {
    const p = personDisplayFromOpsProfile({
      displayName: "Ali Vali Mammadov",
      primaryIdentifierMasked: null,
      accessDenied: false,
    });
    expect(p.firstName).toBe("Ali");
    expect(p.middleName).toBe("Vali");
    expect(p.lastName).toBe("Mammadov");
  });

  it("formatAzEmployeeListName prints surname-first for payroll tables", () => {
    expect(
      formatAzEmployeeListName({
        firstName: "Ali",
        middleName: "Vali",
        lastName: "Mammadov",
      }),
    ).toBe("Mammadov Ali Vali");
  });
});
