jest.mock("@/lib/prisma", () => ({
  prisma: {
    icdCode: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { ICD10_VERSION, IcdCatalogError, icdTitle } from "@/domain/icd/icd-catalog";
import { requireSelectableIcd } from "@/domain/icd/icd-search.service";

type Row = {
  code: string;
  kind: string;
  chapterCode: string;
  parentCode: string | null;
  titleEn: string;
  titleRu: string | null;
  titleAz: string | null;
  selectable: boolean;
};

const { loadIcd10Catalog } = require("../../packages/satellite-kit/icd10/catalog.cjs") as {
  loadIcd10Catalog: () => { version: string; rows: Row[] };
};
const { buildCatalog, serialize } = require("../../packages/satellite-kit/icd10/build-icd10-catalog.cjs") as {
  buildCatalog: () => unknown;
  serialize: (c: unknown) => string;
};

describe("ICD-10 catalog from original sources", () => {
  const { version, rows } = loadIcd10Catalog();
  const byCode = new Map(rows.map((r) => [r.code, r]));

  it("matches the clinic version constant", () => {
    expect(version).toBe(ICD10_VERSION);
  });

  it("bundled JSON equals a fresh build from sources", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const onDisk = readFileSync(
      join(__dirname, "../../packages/satellite-kit/icd10/data/icd10-catalog.json"),
      "utf8",
    );
    expect(serialize(buildCatalog())).toBe(onDisk);
  });

  it("has 22 chapters and the WHO M42 subdivisions only", () => {
    expect(rows.filter((r) => r.kind === "CHAPTER")).toHaveLength(22);
    expect(rows.filter((r) => r.parentCode === "M42").map((r) => r.code)).toEqual([
      "M42.0",
      "M42.1",
      "M42.9",
    ]);
    expect(byCode.has("M42.2")).toBe(false);
    expect(byCode.get("M42.0")?.titleEn).toBe("Juvenile osteochondrosis of spine");
    expect(byCode.get("M42.0")?.titleRu).toMatch(/^Юношеский остеохондроз позвоночника/);
    expect(byCode.get("M42.1")?.titleRu).toBe("Остеохондроз позвоночника у взрослых");
    expect(byCode.get("M42.9")?.titleRu).toBe("Остеохондроз позвоночника неуточненный");
    expect(byCode.get("M42.9")?.titleAz).toBeTruthy();
  });

  it("contains only codes present in the WHO 2019 source file", () => {
    const { readFileSync } = require("node:fs") as typeof import("node:fs");
    const { join } = require("node:path") as typeof import("node:path");
    const who = new Set(
      readFileSync(
        join(__dirname, "../../packages/satellite-kit/icd10/sources/who-2019/icd102019syst_codes.txt"),
        "utf8",
      )
        .split("\n")
        .filter(Boolean)
        .map((line) => line.split(";")[6]),
    );
    const codes = rows.filter((r) => r.kind === "CATEGORY" || r.kind === "LEAF");
    expect(codes.length).toBe(who.size);
    for (const r of codes) expect(who.has(r.code)).toBe(true);
  });

  it("keeps key selectable codes and non-selectable chapters", () => {
    for (const code of ["I10", "M54.5", "J06.9", "Z00.0", "L40"]) {
      const row = byCode.get(code);
      expect(row?.selectable).toBe(true);
      expect(["CATEGORY", "LEAF"]).toContain(row?.kind);
    }
    expect(byCode.get("I")?.selectable).toBe(false);
    expect(byCode.get("I")?.kind).toBe("CHAPTER");
  });
});

describe("icdTitle fallback", () => {
  it("uses the next available source title when a translation is missing", () => {
    const row = { titleEn: "En", titleRu: null, titleAz: null };
    expect(icdTitle(row, "ru")).toBe("En");
    expect(icdTitle({ ...row, titleAz: "Az" }, "ru")).toBe("Az");
    expect(icdTitle({ ...row, titleRu: "Ru" }, "az")).toBe("Ru");
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
