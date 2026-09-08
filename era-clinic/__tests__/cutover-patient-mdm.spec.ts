jest.mock("@era/satellite-kit", () => ({
  linkPersonIdentity: jest.fn(),
  isValidAzFin: (v: string) => /^[0-9A-HJ-NP-Za-hj-np-z]{7}$/.test(String(v || "").trim()),
  composePersonFullName: (
    firstName?: string | null,
    middleName?: string | null,
    lastName?: string | null,
  ) =>
    [firstName, middleName, lastName]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(" "),
  resolveIncomingNameParts: (input: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
  }) => {
    const first = input.firstName?.trim() || null;
    const last = input.lastName?.trim() || null;
    if (first || last) {
      return { firstName: first, middleName: input.middleName?.trim() || null, lastName: last };
    }
    const blob = input.fullName?.trim();
    if (!blob) return null;
    const parts = blob.split(/\s+/).filter(Boolean);
    if (parts.length <= 2) {
      return { firstName: parts[0] ?? null, middleName: null, lastName: parts[1] ?? null };
    }
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(" "),
      lastName: parts[parts.length - 1],
    };
  },
  normalizeNationalityIso: () => null,
}));

jest.mock("@/lib/hotel-stay-person", () => ({
  lookupHotelStayGlobalPerson: jest.fn(),
  lookupHotelGuestByIdentity: jest.fn(),
}));

import { linkPersonIdentity } from "@era/satellite-kit";
import {
  lookupHotelGuestByIdentity,
  lookupHotelStayGlobalPerson,
} from "@/lib/hotel-stay-person";
import { resolveCutoverPatientMdm } from "@/lib/import/cutover-patient-mdm";

const link = linkPersonIdentity as jest.MockedFunction<typeof linkPersonIdentity>;
const hotelLookup = lookupHotelStayGlobalPerson as jest.MockedFunction<
  typeof lookupHotelStayGlobalPerson
>;
const identityLookup = lookupHotelGuestByIdentity as jest.MockedFunction<
  typeof lookupHotelGuestByIdentity
>;

describe("resolveCutoverPatientMdm", () => {
  beforeEach(() => {
    link.mockReset();
    hotelLookup.mockReset();
    identityLookup.mockReset();
  });

  it("reuses existing globalPersonId and does not call hotel", async () => {
    link.mockResolvedValue({ globalPersonId: "gp-existing" });
    const id = await resolveCutoverPatientMdm({
      fullName: "RAFIL KURBANOV",
      sex: "MALE",
      birthDate: "1970-04-13",
      hotelResNo: "11112877",
      existingGlobalPersonId: "gp-existing",
    });
    expect(identityLookup).not.toHaveBeenCalled();
    expect(hotelLookup).not.toHaveBeenCalled();
    expect(link).toHaveBeenCalledWith(
      expect.objectContaining({ globalPersonId: "gp-existing", fullName: "RAFIL KURBANOV" }),
    );
    expect(id).toBe("gp-existing");
  });

  it("prefers name+DOB hotel guest match over WO hotelResNo", async () => {
    identityLookup.mockResolvedValue("gp-name");
    link.mockResolvedValue({ globalPersonId: "gp-name" });
    const id = await resolveCutoverPatientMdm({
      fullName: "Gülarə Həşimova",
      firstName: "Gülarə",
      lastName: "Həşimova",
      birthDate: "1972-08-05",
      phone: "+994501112233",
      hotelResNo: "11111472",
      folioPerson: "1",
      sex: "FEMALE",
    });
    expect(identityLookup).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Gülarə Həşimova",
        birthDate: "1972-08-05",
        phone: "+994501112233",
      }),
    );
    expect(hotelLookup).not.toHaveBeenCalled();
    expect(link).toHaveBeenCalledWith(
      expect.objectContaining({
        fullName: "Gülarə Həşimova",
        globalPersonId: "gp-name",
      }),
    );
    expect(id).toBe("gp-name");
  });

  it("passes FO passport into MDM resolve", async () => {
    identityLookup.mockResolvedValue("gp-name");
    link.mockResolvedValue({ globalPersonId: "gp-name" });
    await resolveCutoverPatientMdm({
      fullName: "Gülarə Həşimova",
      firstName: "Gülarə",
      lastName: "Həşimova",
      birthDate: "1972-08-05",
      passport: "AA5678987",
      sex: "FEMALE",
    });
    expect(link).toHaveBeenCalledWith(
      expect.objectContaining({
        passport: "AA5678987",
        globalPersonId: "gp-name",
      }),
    );
  });

  it("falls back to stay lookup when name+DOB misses", async () => {
    identityLookup.mockResolvedValue(null);
    hotelLookup.mockResolvedValue("gp-hotel");
    link.mockResolvedValue({ globalPersonId: "gp-hotel" });
    const id = await resolveCutoverPatientMdm({
      fullName: "RAFIL KURBANOV",
      hotelResNo: "11112877",
      folioPerson: "1",
      sex: "MALE",
      birthDate: "1970-04-13",
    });
    expect(hotelLookup).toHaveBeenCalledWith({ hotelResNo: "11112877", folioPerson: "1" });
    expect(link).toHaveBeenCalledWith(expect.objectContaining({ globalPersonId: "gp-hotel" }));
    expect(id).toBe("gp-hotel");
  });

  it("still resolves MDM without hotel match (walk-in / surrogate)", async () => {
    identityLookup.mockResolvedValue(null);
    hotelLookup.mockReset();
    hotelLookup.mockResolvedValue(null);
    link.mockResolvedValue({ globalPersonId: "gp-new" });
    const id = await resolveCutoverPatientMdm({
      fullName: "Walk In",
      phone: "+994501112233",
    });
    expect(id).toBe("gp-new");
  });
});
