jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => undefined })),
  headers: jest.fn(async () => ({
    get: (name: string) => (name === "x-era-pathname" ? "/api/auth/me" : null),
  })),
}));

jest.mock("@/lib/prisma", () => ({ prisma: {} }));

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
    readSatelliteStaffSession: jest.fn(async () => null),
  };
});

import {
  IndustryModuleInactiveError,
  readSatelliteStaffSession,
  requireSatelliteModule,
} from "@era/satellite-kit";

describe("CRM PIPE negative paths (AC-CRM-PIPE)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (requireSatelliteModule as jest.Mock).mockImplementation(async (moduleKey: string) => {
      throw new IndustryModuleInactiveError(moduleKey);
    });
  });

  describe("module gate", () => {
    it("getSatelliteSession: no staff session -> null, module gate not reached", async () => {
      const { getSatelliteSession } = await import("@/lib/api-utils");
      await expect(getSatelliteSession()).resolves.toBeNull();
      expect(requireSatelliteModule).not.toHaveBeenCalled();
    });

    it("getSatelliteSession: inactive module -> IndustryModuleInactiveError for the token org", async () => {
      (readSatelliteStaffSession as jest.Mock).mockResolvedValueOnce({
        session: { sub: "u-1", login: "staff", role: "STAFF", organizationId: "org-1" },
        user: { organizationId: "org-1", active: true },
      });
      const { getSatelliteSession } = await import("@/lib/api-utils");
      await expect(getSatelliteSession()).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_crm",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_crm", { organizationId: "org-1" });
    });

    it("requireCrmSatellite checks the module for the given org", async () => {
      const { requireCrmSatellite } = await import("@/lib/crm-module-gate");
      await expect(requireCrmSatellite("org-1")).rejects.toMatchObject({
        name: "IndustryModuleInactiveError",
        moduleKey: "industry_crm",
      });
      expect(requireSatelliteModule).toHaveBeenCalledWith("industry_crm", { organizationId: "org-1" });
    });


    it("handleRouteError maps IndustryModuleInactiveError to 403", async () => {
      const { handleRouteError } = await import("@/lib/api-utils");
      const res = handleRouteError(new IndustryModuleInactiveError("industry_crm"));
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toMatch(/industry_crm/);
    });
  });

  describe("domain deny", () => {
    it("refuses lead assign without api:leads.assign; seed grants it to SALES_LEAD only", async () => {
      const { assertApiRouteGrant } = await import("@/lib/auth/require");
      const { ROLE_TEMPLATES, PERMISSIONS } = await import("@/lib/auth/permissions");
      const path = "/api/leads/lead-1/assign";
      const as = (role: keyof typeof ROLE_TEMPLATES) => ({
        login: "staff",
        role,
        permissions: [...ROLE_TEMPLATES[role]],
      });
      expect(() => assertApiRouteGrant(as("SALES_AGENT"), path)).toThrow(
        expect.objectContaining({ status: 403 }),
      );
      expect(() => assertApiRouteGrant(as("FIELD_REP"), path)).toThrow(
        expect.objectContaining({ status: 403 }),
      );
      expect(() => assertApiRouteGrant(as("SALES_LEAD"), path)).not.toThrow();
      expect(() =>
        assertApiRouteGrant({ login: "owner", role: "BUSINESS_OWNER", permissions: [] }, path),
      ).not.toThrow();
      expect(ROLE_TEMPLATES.SALES_AGENT).not.toContain(PERMISSIONS.LEADS_ASSIGN);
    });

    it("blocks stage advance to QUALIFIED without party VÖEN", async () => {
      const { validatePartyForStage } = await import("@/lib/lead-party");
      const err = validatePartyForStage(
        {
          partyKind: "LEGAL_ENTITY",
          taxId: "123",
          companyName: "Test MMC",
          contactPhone: null,
          stage: "NEW",
        },
        "QUALIFIED",
      );
      expect(err).toMatch(/VÖEN/);
    });
  });
});
