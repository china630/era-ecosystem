import {
  buildPatientDemographicsFillPatch,
  patientNeedsMdmDemographicsFill,
} from "@/domain/patient/mdm-demographics-cache";

describe("patient MDM demographics fill (list holes)", () => {
  const base = {
    id: "p1",
    globalPersonId: "g1",
    sex: "UNKNOWN" as const,
    birthDate: null as Date | null,
    firstName: "Aidə",
    middleName: null as string | null,
    lastName: "İbrahimova",
    fullName: "Aidə İbrahimova",
  };

  it("needs fill when MDM linked and sex/DOB missing", () => {
    expect(patientNeedsMdmDemographicsFill(base)).toBe(true);
    expect(
      patientNeedsMdmDemographicsFill({
        ...base,
        sex: "FEMALE",
        birthDate: new Date("1980-01-01T00:00:00.000Z"),
      }),
    ).toBe(false);
  });

  it("skips rows without MDM and reception-complete rows", () => {
    expect(
      patientNeedsMdmDemographicsFill({ ...base, globalPersonId: null }),
    ).toBe(false);
    expect(
      patientNeedsMdmDemographicsFill({
        ...base,
        sex: "FEMALE",
        birthDate: new Date("1990-05-05T00:00:00.000Z"),
        firstName: "A",
        lastName: "B",
      }),
    ).toBe(false);
  });

  it("fill-not-clear: does not overwrite reception sex/DOB/name", () => {
    const patch = buildPatientDemographicsFillPatch(
      {
        ...base,
        sex: "FEMALE",
        birthDate: new Date("1991-02-03T00:00:00.000Z"),
        firstName: "Clinic",
        lastName: "Filled",
        fullName: "Clinic Filled",
      },
      {
        firstName: "Mdm",
        lastName: "Name",
        sex: "MALE",
        birthDate: "2000-01-01",
      },
    );
    expect(patch).toBeNull();
  });

  it("fills UNKNOWN sex and empty DOB from MDM", () => {
    const patch = buildPatientDemographicsFillPatch(base, {
      sex: "FEMALE",
      birthDate: "1985-06-15",
      firstName: "Aidə",
      lastName: "İbrahimova",
    });
    expect(patch?.sex).toBe("FEMALE");
    expect(patch?.birthDate?.toISOString().slice(0, 10)).toBe("1985-06-15");
  });
});
