import {
  emptyPax,
  hydratePaxDemographicsFromGuest,
  hydratePaxNames,
} from "@/components/reservation-card/party-pax";

describe("hydratePaxNames", () => {
  it("fills companion names from linked Guest map, not the booker", () => {
    const rows = [
      emptyPax({ guestId: "g-mahir", isPrimary: true }),
      emptyPax({ guestId: "g-gulduze" }),
    ];
    const out = hydratePaxNames(
      rows,
      { id: "g-mahir", fullName: "Mahir Asadov" },
      new Map([["g-gulduze", "Gulduze Asadova"]]),
    );
    expect(out[0]).toMatchObject({ firstName: "Mahir", lastName: "Asadov" });
    expect(out[1]).toMatchObject({ firstName: "Gulduze", lastName: "Asadova" });
  });
});

describe("hydratePaxDemographicsFromGuest", () => {
  it("fills sex/DOB/nationality/passport/age from Guest when snapshot empty", () => {
    const rows = [
      emptyPax({
        guestId: "g-val",
        firstName: "Valentina",
        lastName: "Akulova",
        isPrimary: true,
      }),
    ];
    const out = hydratePaxDemographicsFromGuest(
      rows,
      new Map([
        [
          "g-val",
          {
            id: "g-val",
            sex: "F",
            nationality: "RU",
            birthDate: "1959-07-19",
            documents: [{ docType: "PASSPORT", docNumber: "671003206", isPrimary: true }],
          },
        ],
      ]),
    );
    expect(out[0]).toMatchObject({
      sex: "F",
      nationality: "RU",
      birthDate: "1959-07-19",
      passportNo: "671003206",
    });
    expect(Number(out[0]?.age)).toBeGreaterThan(60);
  });

  it("does not overwrite reception-filled snapshot fields", () => {
    const rows = [
      emptyPax({
        guestId: "g1",
        sex: "M",
        nationality: "AZ",
        birthDate: "1990-01-01",
        age: "36",
        passportNo: "KEEP",
      }),
    ];
    const out = hydratePaxDemographicsFromGuest(
      rows,
      new Map([
        [
          "g1",
          {
            id: "g1",
            sex: "F",
            nationality: "RU",
            birthDate: "1959-07-19",
            documents: [{ docType: "PASSPORT", docNumber: "OTHER" }],
          },
        ],
      ]),
    );
    expect(out[0]).toMatchObject({
      sex: "M",
      nationality: "AZ",
      birthDate: "1990-01-01",
      age: "36",
      passportNo: "KEEP",
    });
  });
});
