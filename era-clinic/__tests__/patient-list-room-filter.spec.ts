jest.mock("@era/satellite-kit", () => ({
  listPersonIdentifiers: jest.fn().mockResolvedValue({ identifiers: [] }),
  linkPersonIdentity: jest.fn().mockResolvedValue({ globalPersonId: null }),
  satelliteOrganizationId: jest.fn().mockReturnValue("test-org"),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    patientRef: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    clinicalEpisode: {
      findMany: jest.fn(),
    },
  },
}));

describe("listPatientsPaged hotel room filter", () => {
  beforeEach(() => {
    jest.resetModules();
  });

  it("scopes OPEN episodes by roomNumber and returns hotelRoomNumber", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.patientRef.findMany.mockResolvedValue([
      {
        id: "p1",
        refCode: "P1",
        fullName: "Ali",
        birthDate: null,
        episodes: [{ roomNumber: "101" }],
      },
    ]);
    prisma.patientRef.count.mockResolvedValue(1);
    prisma.clinicalEpisode.findMany.mockResolvedValue([{ roomNumber: "101" }]);

    const { listPatientsPaged } = await import("@/domain/patient/patient.service");
    const result = await listPatientsPaged({
      roomNumber: "101",
      includeHotelRooms: true,
    });

    expect(prisma.patientRef.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          episodes: {
            some: {
              status: "OPEN",
              roomNumber: { equals: "101", mode: "insensitive" },
            },
          },
        },
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({ hotelRoomNumber: "101" }),
    );
    expect(result.hotelRooms).toEqual(["101"]);
  });

  it("does not query hotel rooms unless requested", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.patientRef.findMany.mockResolvedValue([]);
    prisma.patientRef.count.mockResolvedValue(0);

    const { listPatientsPaged } = await import("@/domain/patient/patient.service");
    const result = await listPatientsPaged({});

    expect(prisma.clinicalEpisode.findMany).not.toHaveBeenCalled();
    expect(result.hotelRooms).toBeUndefined();
  });
});
