import {
  PractitionerMdmRequiredError,
  practitionerHasIdentifierInput,
  resolvePractitionerGlobalPerson,
} from "@/lib/practitioner-identity";

jest.mock("@era/satellite-kit", () => {
  const actual = jest.requireActual("./mocks/satellite-kit");
  return actual;
});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    practitioner: {
      update: jest.fn(),
    },
  },
}));

describe("practitioner MDM enforcement", () => {
  it("requires identifier input for create", () => {
    expect(
      practitionerHasIdentifierInput({ fin: "", passport: "", issuingCountry: "" }),
    ).toBe(false);
    expect(practitionerHasIdentifierInput({ fin: "ABC1234" })).toBe(true);
    expect(
      practitionerHasIdentifierInput({ passport: "P123", issuingCountry: "AZ" }),
    ).toBe(true);
  });

  it("throws when create without identifier", async () => {
    await expect(
      resolvePractitionerGlobalPerson({ fullName: "Dr Test" }),
    ).rejects.toBeInstanceOf(PractitionerMdmRequiredError);
  });

  it("throws when MDM unresolved", async () => {
    const { linkPersonIdentity } = jest.requireMock("@era/satellite-kit");
    linkPersonIdentity.mockResolvedValue({ globalPersonId: null });
    await expect(
      resolvePractitionerGlobalPerson({
        fullName: "Dr Test",
        fin: "ABC1234",
      }),
    ).rejects.toBeInstanceOf(PractitionerMdmRequiredError);
  });

  it("returns globalPersonId when MDM resolves", async () => {
    const { linkPersonIdentity } = jest.requireMock("@era/satellite-kit");
    linkPersonIdentity.mockResolvedValue({ globalPersonId: "gp-1" });
    await expect(
      resolvePractitionerGlobalPerson({
        fullName: "Dr Test",
        fin: "ABC1234",
      }),
    ).resolves.toBe("gp-1");
  });
});
