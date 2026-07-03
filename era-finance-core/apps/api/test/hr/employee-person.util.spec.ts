import {
  personDisplayFromOpsProfile,
  splitAzPersonName,
} from "../../src/hr/employee-person.util";

describe("employee-person.util", () => {
  it("splitAzPersonName uses first token as surname", () => {
    expect(splitAzPersonName("Aliyev Ali Vali")).toEqual({
      lastName: "Aliyev",
      firstName: "Ali Vali",
    });
  });

  it("personDisplayFromOpsProfile never exposes plaintext FIN", () => {
    const p = personDisplayFromOpsProfile({
      displayName: "Aliyev Ali",
      primaryIdentifierMasked: "1****C4",
      accessDenied: false,
    });
    expect(p.finCode).toBe("1****C4");
    expect(p.firstName).toBe("Ali");
  });
});
