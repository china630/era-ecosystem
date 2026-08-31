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
        episodes: [{ roomNumber: "101", reservationId: "11112877", openedAt: new Date("2026-08-27T00:00:00+04:00"), closedAt: null, programInstance: { endsOn: new Date("2026-09-04T00:00:00+04:00") } }],
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
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        hotelRoomNumber: "101",
        checkInAt: expect.stringMatching(/^2026-08-26|^2026-08-27/),
        checkOutAt: expect.stringMatching(/^2026-09-03|^2026-09-04/),
      }),
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
