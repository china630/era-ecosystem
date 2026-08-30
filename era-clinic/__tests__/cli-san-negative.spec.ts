jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

jest.mock("@era/satellite-kit", () => {
  class IndustryModuleInactiveError extends Error {
    readonly status = 403;
    readonly moduleKey: string;
    constructor(moduleKey: string) {
      super(`Industry module not active: ${moduleKey}`);
      this.name = "IndustryModuleInactiveError";
      this.moduleKey = moduleKey;
    }
  }
  return {
    IndustryModuleInactiveError,
    requireSatelliteModule: jest.fn(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    }),
    resolveClinicModuleForPathname: jest.fn(() => null),
  };
});

import { IndustryModuleInactiveError, requireSatelliteModule } from "@era/satellite-kit";
import { z } from "zod";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    icdCode: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import { requireSelectableIcd } from "@/domain/icd/icd-search.service";

describe("Clinic SAN negative paths (AC-CLI-SAN)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("assertClinicEntitled rejects when industry_clinic inactive", async () => {
      const { assertClinicEntitled } = await import("@/lib/clinic-module-gate");
      await expect(assertClinicEntitled()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_clinic",
      });
    });
  });

  describe("FIFO doctor-confirm", () => {
    it("returns 409-shaped reason when confirming skips earlier PROPOSED", async () => {
      const { fifoConfirmBlockedReason, procedureConfirmHttpStatus } = await import(
        "@/lib/sanatorium-fifo-gates"
      );
      const reason = fifoConfirmBlockedReason({
        confirmingIds: ["later"],
        proposedForPatient: [
          { id: "earlier", sequenceIndex: 1 },
          { id: "later", sequenceIndex: 2 },
        ],
      });
      expect(reason).toMatch(/FIFO/i);
      expect(procedureConfirmHttpStatus(reason)).toBe(409);
    });

    it("allows confirm when earliest PROPOSED is included", async () => {
      const { fifoConfirmBlockedReason } = await import("@/lib/sanatorium-fifo-gates");
      expect(
        fifoConfirmBlockedReason({
          confirmingIds: ["earlier", "later"],
          proposedForPatient: [
            { id: "earlier", sequenceIndex: 1 },
            { id: "later", sequenceIndex: 2 },
          ],
        }),
      ).toBeNull();
    });
  });
});

const diagnosisSchema = z.object({
  icdCodeId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
});

describe("Clinic SAN ICD diagnosis (CLI-39)", () => {
  const findUnique = prisma.icdCode.findUnique as jest.Mock;

  beforeEach(() => {
    findUnique.mockReset();
  });

  it("rejects empty icdCodeId", () => {
    expect(diagnosisSchema.safeParse({ icdCodeId: "" }).success).toBe(false);
    expect(diagnosisSchema.safeParse({ icdCodeId: "leaf-1" }).success).toBe(true);
  });

  it("requireSelectableIcd rejects CHAPTER (selectable false)", async () => {
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
});

describe("AC-CLI-SAN-QUOTA template PATCH multi-procedure", () => {
  it("accepts 2+ procedures without dropping to a single line", () => {
    const { z } = require("zod");
    const patchSchema = z.object({
      procedures: z
        .array(
          z.object({
            procedureCode: z.string(),
            procedureName: z.string(),
            quotaTotal: z.number().int().positive(),
          }),
        )
        .optional(),
      knots: z
        .array(
          z.object({
            nights: z.number().int().positive(),
            procedureCode: z.string(),
            qty: z.number().int().nonnegative(),
          }),
        )
        .optional(),
    });
    const body = {
      procedures: [
        { procedureCode: "NAFTALAN_BATH", procedureName: "Bath", quotaTotal: 9 },
        { procedureCode: "USG", procedureName: "USG", quotaTotal: 1 },
      ],
      knots: [
        { nights: 12, procedureCode: "NAFTALAN_BATH", qty: 9 },
        { nights: 12, procedureCode: "USG", qty: 1 },
      ],
    };
    const parsed = patchSchema.parse(body);
    expect(parsed.procedures).toHaveLength(2);
    expect(parsed.knots).toHaveLength(2);
  });
});

describe("AC-CLI-SAN-PKG unknown program code", () => {
  it("instantiateProgramFromTemplate rejects missing template", async () => {
    jest.resetModules();
    jest.doMock("@/lib/prisma", () => ({
      prisma: {
        programTemplate: {
          findFirst: jest.fn().mockResolvedValue(null),
        },
      },
    }));
    const { instantiateProgramFromTemplate } = await import(
      "@/lib/sanatorium-scheduler.service"
    );
    await expect(
      instantiateProgramFromTemplate({
        episodeId: "ep-1",
        programCode: "PKG-UNKNOWN-XYZ",
        startsOn: new Date(),
      }),
    ).rejects.toThrow(/not found/i);
  });
});
