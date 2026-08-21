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

describe("Clinic PT negative paths (AC-CLI-PT)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("requireClinicSatellite rejects when industry_clinic inactive", async () => {
      const { requireClinicSatellite } = await import("@/lib/clinic-module-gate");
      await expect(requireClinicSatellite()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_clinic",
      });
    });
  });

  describe("domain deny", () => {
    it("refuses patient create without identifier / name", async () => {
      const { patientCreateDenied } = await import("@/lib/patient-card-gates");
      expect(patientCreateDenied({ hasIdentifier: false, fullName: "Ali" })).toMatch(
        /globalPersonId|FIN|passport|MDM/i,
      );
      expect(patientCreateDenied({ hasIdentifier: true, fullName: "" })).toMatch(/fullName/);
      expect(patientCreateDenied({ hasIdentifier: true, fullName: "Ali" })).toBeNull();
    });

    it("refuses empty anamnesis when updating clinical demographics", async () => {
      const { patientAnamnesisDenied } = await import("@/lib/patient-card-gates");
      expect(patientAnamnesisDenied("   ", true)).toMatch(/Anamnesis/);
      expect(patientAnamnesisDenied("ok", true)).toBeNull();
      expect(patientAnamnesisDenied("", false)).toBeNull();
    });

    it("refuses ICD write on the patient card without an open episode", async () => {
      const { patientCardDiagnosisWriteDenied } = await import("@/lib/patient-card-gates");
      expect(patientCardDiagnosisWriteDenied(false)).toMatch(/open sanatorium episode/i);
      expect(patientCardDiagnosisWriteDenied(true)).toBeNull();
    });
  });
});
