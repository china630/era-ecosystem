jest.mock("@/lib/prisma", () => ({
  prisma: {
    icdCode: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { IcdCatalogError } from "@/domain/icd/icd-catalog";
import { requireSelectableIcd } from "@/domain/icd/icd-search.service";

const { generateIcd10Catalog, catalogStats } = require("../prisma/seed-data/icd10/generate-icd10.cjs") as {
  generateIcd10Catalog: () => {
    rows: Array<{ code: string; kind: string; selectable: boolean }>;
    version: string;
  };
  catalogStats: (rows: Array<{ code: string; kind: string; selectable: boolean }>) => {
    chapterCount: number;
    hasI10: boolean;
    hasM545: boolean;
    hasJ069: boolean;
    hasZ000: boolean;
    selectable: number;
  };
};

describe("WHO ICD-10 catalog generator", () => {
  it("has 22 chapters and key selectable codes", () => {
    const { rows } = generateIcd10Catalog();
    const stats = catalogStats(rows);
    expect(stats.chapterCount).toBe(22);
    expect(stats.hasI10).toBe(true);
    expect(stats.hasM545).toBe(true);
    expect(stats.hasJ069).toBe(true);
    expect(stats.hasZ000).toBe(true);

    const byCode = new Map(rows.map((r) => [r.code, r]));
    for (const code of ["I10", "M54.5", "J06.9", "Z00.0"]) {
      const row = byCode.get(code);
      expect(row).toBeDefined();
      expect(row?.selectable).toBe(true);
      expect(["CATEGORY", "LEAF"]).toContain(row?.kind);
    }
    expect(byCode.get("I")?.selectable).toBe(false);
    expect(byCode.get("I")?.kind).toBe("CHAPTER");
  });
});

describe("requireSelectableIcd", () => {
  const findUnique = prisma.icdCode.findUnique as jest.Mock;

  beforeEach(() => {
    findUnique.mockReset();
  });

  it("rejects missing codes", async () => {
    findUnique.mockResolvedValue(null);
    await expect(requireSelectableIcd("missing")).rejects.toMatchObject({
      name: "IcdCatalogError",
      status: 400,
      message: expect.stringMatching(/not found/i),
    });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: "missing" } });
  });

  it("rejects inactive codes", async () => {
    findUnique.mockResolvedValue({
      id: "x",
      code: "I10",
      kind: "CATEGORY",
      selectable: true,
      active: false,
    });
    await expect(requireSelectableIcd("x")).rejects.toBeInstanceOf(IcdCatalogError);
    await expect(requireSelectableIcd("x")).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/inactive/i),
    });
  });

  it("rejects CHAPTER (selectable false)", async () => {
    findUnique.mockResolvedValue({
      id: "ch",
      code: "IX",
      kind: "CHAPTER",
      selectable: false,
      active: true,
    });
    await expect(requireSelectableIcd("ch")).rejects.toMatchObject({
      name: "IcdCatalogError",
      status: 400,
      message: expect.stringMatching(/selectable/i),
    });
  });

  it("accepts a selectable LEAF", async () => {
    const leaf = {
      id: "leaf",
      code: "M54.5",
      kind: "LEAF",
      selectable: true,
      active: true,
    };
    findUnique.mockResolvedValue(leaf);
    await expect(requireSelectableIcd("leaf")).resolves.toEqual(leaf);
  });
});
