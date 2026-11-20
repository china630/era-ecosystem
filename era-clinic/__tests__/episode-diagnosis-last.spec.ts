jest.mock("@/domain/sanatorium/episode-audit.service", () => ({
  recordEpisodeAudit: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    clinicalDiagnosis: {
      findUnique: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { deleteEpisodeDiagnosis } from "@/domain/icd/diagnosis-write.service";
import { IcdCatalogError } from "@/domain/icd/icd-catalog";

const findUnique = prisma.clinicalDiagnosis.findUnique as jest.Mock;
const count = prisma.clinicalDiagnosis.count as jest.Mock;
const del = prisma.clinicalDiagnosis.delete as jest.Mock;

const baseRow = {
  id: "dx-1",
  episodeId: "ep-1",
  icdCodeId: "icd-1",
  note: null,
  icdCode: { code: "J00" },
  episode: { id: "ep-1", patientRefId: "pat-1", status: "OPEN" as const },
};

describe("deleteEpisodeDiagnosis last diagnosis guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws LAST_DIAGNOSIS when only one diagnosis remains on the episode", async () => {
    findUnique.mockResolvedValue(baseRow);
    count.mockResolvedValue(1);

    await expect(deleteEpisodeDiagnosis("dx-1", "pat-1")).rejects.toMatchObject({
      message: "Last diagnosis cannot be deleted",
      name: "IcdCatalogError",
      status: 409,
      code: "LAST_DIAGNOSIS",
    });
    expect(del).not.toHaveBeenCalled();
  });

  it("deletes when more than one diagnosis exists on the episode", async () => {
    findUnique.mockResolvedValue(baseRow);
    count.mockResolvedValue(2);
    del.mockResolvedValue(undefined);

    await deleteEpisodeDiagnosis("dx-1", "pat-1");

    expect(del).toHaveBeenCalledWith({ where: { id: "dx-1" } });
  });

  it("throws IcdCatalogError on last delete", async () => {
    findUnique.mockResolvedValue(baseRow);
    count.mockResolvedValue(1);

    try {
      await deleteEpisodeDiagnosis("dx-1", "pat-1");
      fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(IcdCatalogError);
      expect((err as Error & { code?: string }).code).toBe("LAST_DIAGNOSIS");
    }
  });
});