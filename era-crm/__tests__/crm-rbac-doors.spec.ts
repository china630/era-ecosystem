jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

const headerValues: Record<string, string | null> = {};
jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({ get: () => undefined })),
  headers: jest.fn(async () => ({ get: (name: string) => headerValues[name] ?? null })),
}));

const findUnique = jest.fn();
const findMany = jest.fn();
jest.mock("@/lib/prisma", () => ({ prisma: { lead: { findUnique, findMany } } }));

jest.mock("@era/satellite-kit", () => {
  class IndustryModuleInactiveError extends Error {}
  return {
    IndustryModuleInactiveError,
    requireSatelliteModule: jest.fn(async () => undefined),
    readSatelliteStaffSession: jest.fn(async () => null),
  };
});

import { readSatelliteStaffSession } from "@era/satellite-kit";
import { PERMISSIONS, ROLE_CODES, ROLE_TEMPLATES, PERMISSION_CATALOG_VERSION } from "@/lib/auth/permissions";

function staffAs(roleCode: string, permissions: readonly string[] = ROLE_TEMPLATES[roleCode as keyof typeof ROLE_TEMPLATES]) {
  (readSatelliteStaffSession as jest.Mock).mockResolvedValue({
    session: { sub: "u-1", login: "staff", role: roleCode, fullName: "Staff", organizationId: "org-1" },
    user: {
      organizationId: "org-1",
      active: true,
      login: "staff",
      email: null,
      role: {
        code: roleCode,
        permissionsJson: JSON.stringify(permissions),
        permissionCatalogVersion: PERMISSION_CATALOG_VERSION,
      },
    },
  });
}

const assignRequest = () =>
  new Request("http://x", { method: "PATCH", body: JSON.stringify({ ownerId: null }) });

describe("CRM doors (CRM-RBAC-01)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of Object.keys(headerValues)) delete headerValues[k];
    findUnique.mockResolvedValue(null);
    findMany.mockResolvedValue([]);
  });

  it("assign, import and pipeline stay on the sales lead; agent, field rep and CP members do not get them", () => {
    for (const code of [
      ROLE_CODES.SALES_AGENT,
      ROLE_CODES.FIELD_REP,
      ROLE_CODES.PLATFORM_MEMBER,
      ROLE_CODES.SATELLITE_OPERATOR,
    ]) {
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.LEADS_ASSIGN);
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.ADMIN_IMPORT);
      expect(ROLE_TEMPLATES[code]).not.toContain(PERMISSIONS.ADMIN_PIPELINE);
      expect(ROLE_TEMPLATES[code]).toContain(PERMISSIONS.LEADS_WRITE);
    }
    expect(ROLE_TEMPLATES[ROLE_CODES.SALES_LEAD]).toContain(PERMISSIONS.LEADS_ASSIGN);
  });

  it("agent assign → 403 from the handler", async () => {
    headerValues["x-era-pathname"] = "/api/leads/l1/assign";
    staffAs(ROLE_CODES.SALES_AGENT);
    const { PATCH } = await import("../app/api/leads/[id]/assign/route");
    const res = await PATCH(assignRequest(), { params: Promise.resolve({ id: "l1" }) });
    expect(res.status).toBe(403);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("sales lead passes the assign door (then 404 on the missing lead)", async () => {
    headerValues["x-era-pathname"] = "/api/leads/l1/assign";
    staffAs(ROLE_CODES.SALES_LEAD);
    const { PATCH } = await import("../app/api/leads/[id]/assign/route");
    const res = await PATCH(assignRequest(), { params: Promise.resolve({ id: "l1" }) });
    expect(res.status).toBe(404);
  });

  it("a sales lead whose package lost leads.assign is denied (grant, not name)", async () => {
    headerValues["x-era-pathname"] = "/api/leads/l1/assign";
    staffAs(
      ROLE_CODES.SALES_LEAD,
      ROLE_TEMPLATES[ROLE_CODES.SALES_LEAD].filter((p) => p !== PERMISSIONS.LEADS_ASSIGN),
    );
    const { PATCH } = await import("../app/api/leads/[id]/assign/route");
    const res = await PATCH(assignRequest(), { params: Promise.resolve({ id: "l1" }) });
    expect(res.status).toBe(403);
  });

  it("list and create check their own method grant", async () => {
    staffAs(
      ROLE_CODES.SALES_AGENT,
      ROLE_TEMPLATES[ROLE_CODES.SALES_AGENT].filter((p) => p !== PERMISSIONS.LEADS_WRITE),
    );
    headerValues["x-era-pathname"] = "/api/leads";
    const { GET, POST } = await import("../app/api/leads/route");
    expect((await GET(new Request("http://x/api/leads"))).status).toBe(200);
    const res = await POST(new Request("http://x/api/leads", { method: "POST", body: "{}" }));
    expect(res.status).toBe(403);
  });

  it("the central gate denies a stamped API path the package lacks", async () => {
    staffAs(ROLE_CODES.SALES_AGENT);
    const { getSatelliteSession } = await import("@/lib/api-utils");
    for (const path of ["/api/leads/import", "/api/pipeline/rules", "/api/admin/roles"]) {
      headerValues["x-era-pathname"] = path;
      await expect(getSatelliteSession()).rejects.toMatchObject({ name: "PermissionDeniedError" });
    }
    headerValues["x-era-pathname"] = "/api/leads";
    await expect(getSatelliteSession()).resolves.toMatchObject({ role: ROLE_CODES.SALES_AGENT });
  });
});
