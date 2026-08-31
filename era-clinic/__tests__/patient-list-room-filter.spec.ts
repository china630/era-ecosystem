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

  it("scopes OPEN episodes by roomNumber when episodeStatus OPEN", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.patientRef.findMany.mockResolvedValue([
      {
        id: "p1",
        refCode: "P1",
        fullName: "Ali",
        birthDate: null,
        episodes: [{ id: "ep1" }],
      },
    ]);
    prisma.patientRef.count.mockResolvedValue(1);
    prisma.clinicalEpisode.findMany.mockResolvedValue([{ roomNumber: "101" }]);

    const { listPatientsPaged } = await import("@/domain/patient/patient.service");
    const result = await listPatientsPaged({
      episodeStatus: "OPEN",
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
        hasOpenEpisode: true,
      }),
    );
    expect(result.hotelRooms).toEqual(["101"]);
  });

  it("defaults to ALL patients without episode filter", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.patientRef.findMany.mockResolvedValue([]);
    prisma.patientRef.count.mockResolvedValue(0);

    const { listPatientsPaged } = await import("@/domain/patient/patient.service");
    const result = await listPatientsPaged({});

    expect(prisma.patientRef.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {},
      }),
    );
    expect(prisma.clinicalEpisode.findMany).not.toHaveBeenCalled();
    expect(result.hotelRooms).toBeUndefined();
  });

  it("episodeStatus ALL skips episode status constraint", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.patientRef.findMany.mockResolvedValue([]);
    prisma.patientRef.count.mockResolvedValue(0);

    const { listPatientsPaged } = await import("@/domain/patient/patient.service");
    await listPatientsPaged({ episodeStatus: "ALL" });

    expect(prisma.patientRef.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("episodeStatus CLOSED requires closed course and no open", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.patientRef.findMany.mockResolvedValue([]);
    prisma.patientRef.count.mockResolvedValue(0);

    const { listPatientsPaged } = await import("@/domain/patient/patient.service");
    await listPatientsPaged({ episodeStatus: "CLOSED" });

    expect(prisma.patientRef.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { episodes: { some: { status: "CLOSED" } } },
            { episodes: { none: { status: "OPEN" } } },
          ],
        },
      }),
    );
  });
});
