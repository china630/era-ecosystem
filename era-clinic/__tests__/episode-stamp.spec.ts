import { stampEpisodeOnCreate } from "@/domain/sanatorium/episode-stamp";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    clinicalEpisode: {
      findFirst: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const mockedFindFirst = prisma.clinicalEpisode.findFirst as jest.Mock;

describe("stampEpisodeOnCreate", () => {
  beforeEach(() => {
    mockedFindFirst.mockReset();
  });

  it("returns explicit clinicalEpisodeId", async () => {
    await expect(
      stampEpisodeOnCreate({
        patientRefId: "p1",
        clinicalEpisodeId: "ep-explicit",
      }),
    ).resolves.toBe("ep-explicit");
    expect(mockedFindFirst).not.toHaveBeenCalled();
  });

  it("resolves OPEN episode by reservation then patient", async () => {
    mockedFindFirst.mockResolvedValueOnce({
      id: "ep-open",
      status: "OPEN",
      anamnesisText: null,
    });
    await expect(
      stampEpisodeOnCreate({
        patientRefId: "p1",
        reservationId: "res-1",
      }),
    ).resolves.toBe("ep-open");
    expect(mockedFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          patientRefId: "p1",
          status: "OPEN",
          reservationId: "res-1",
        }),
      }),
    );
  });

  it("returns null when no OPEN episode (Pattern B)", async () => {
    mockedFindFirst.mockResolvedValue(null);
    await expect(
      stampEpisodeOnCreate({ patientRefId: "p1" }),
    ).resolves.toBeNull();
  });
});
