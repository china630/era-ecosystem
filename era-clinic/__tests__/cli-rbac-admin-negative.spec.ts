jest.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => ({
      status: init?.status ?? 200,
      json: async () => data,
    }),
  },
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  CLINIC_PERMISSION,
  DEFAULT_ROLE_PERMISSIONS,
  adminApiRoutePermission,
} from "@/lib/auth/clinic-permissions";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { assertClinicPermission } from "@/lib/auth/clinic-permission.service";
import { sessionHasClinicPermission } from "@/lib/auth/clinic-permission-check";
import { buildClinicNav } from "@/domain/nav/clinic-nav";

type Session = {
  sub: string;
  login: string;
  role: string;
  fullName: string;
  isOwner?: boolean;
  email?: string;
};

function adminSession(overrides: Partial<Session> = {}): Session {
  return {
    sub: "admin-1",
    login: "clinic-admin",
    role: CLINIC_ROLE.CLINIC_ADMIN,
    fullName: "Clinic Admin",
    ...overrides,
  };
}

function mockStoredPermissions(roleCode: string, permissions: string[]) {
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: "admin-1",
    role: {
      code: roleCode,
      permissionsJson: JSON.stringify(permissions),
    },
  });
}

describe("Clinic RBAC admin matrix (Wave 2)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("CLINIC_ADMIN missing screen:admin.catalog → assertClinicPermission 403", async () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.CLINIC_ADMIN].filter(
      (p) => p !== CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
    );
    mockStoredPermissions(CLINIC_ROLE.CLINIC_ADMIN, perms);
    const res = await assertClinicPermission(
      adminSession(),
      CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
    );
    expect(res?.status).toBe(403);
  });

  it("CLINIC_ADMIN with screen:admin.catalog → pass", async () => {
    mockStoredPermissions(
      CLINIC_ROLE.CLINIC_ADMIN,
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.CLINIC_ADMIN],
    );
    const res = await assertClinicPermission(
      adminSession(),
      CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
    );
    expect(res).toBeNull();
  });

  it("sessionHasClinicPermission does not bypass on CLINIC_ADMIN role alone", () => {
    const session = {
      ...adminSession(),
      permissions: [CLINIC_PERMISSION.SCREEN_HOME],
    };
    expect(
      sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG),
    ).toBe(false);
  });

  it("OrgOwner (isOwner) still bypasses permission checks", () => {
    const session = {
      ...adminSession({ isOwner: true, role: "BUSINESS_OWNER" }),
      permissions: [] as string[],
    };
    expect(
      sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG),
    ).toBe(true);
  });

  it("adminApiRoutePermission maps diagnostic-catalog services", () => {
    expect(
      adminApiRoutePermission("/api/admin/diagnostic-catalog/services"),
    ).toBe(CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG);
  });

  it("adminApiRoutePermission maps import and audit prefixes", () => {
    expect(adminApiRoutePermission("/api/import/patients")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_IMPORT,
    );
    expect(adminApiRoutePermission("/api/audit")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_AUDIT,
    );
    expect(adminApiRoutePermission("/api/catalog/sync")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
    );
  });

  it("buildClinicNav hides admin catalog when permission absent", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.CLINIC_ADMIN].filter(
      (p) => p !== CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
    );
    const nav = buildClinicNav(
      {
        role: CLINIC_ROLE.CLINIC_ADMIN,
        permissions: perms,
        presetEnabled: () => true,
      },
      (key) => key,
    );
    const hrefs = [
      ...nav.topItems.map((i) => i.href),
      ...nav.sections.flatMap((s) => s.items.map((i) => i.href)),
    ];
    expect(hrefs).not.toContain("/admin/catalog");
  });
});
