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
} from "@/lib/auth/clinic-permissions";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { assertClinicPermission } from "@/lib/auth/clinic-permission.service";

type Session = {
  sub: string;
  login: string;
  role: string;
  fullName: string;
};

function opsSession(role: string): Session {
  return { sub: "user-1", login: "ops", role, fullName: "Ops" };
}

function mockStoredPermissions(roleCode: string, permissions: string[]) {
  (prisma.user.findUnique as jest.Mock).mockResolvedValue({
    id: "user-1",
    role: {
      code: roleCode,
      permissionsJson: JSON.stringify(permissions),
    },
  });
}

describe("Clinic RBAC negative paths (Wave 1)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("DOCTOR without api:sanatorium.resources is 403", async () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR].filter(
      (p) => p !== CLINIC_PERMISSION.API_SANATORIUM_RESOURCES,
    );
    mockStoredPermissions(CLINIC_ROLE.DOCTOR, perms);
    const res = await assertClinicPermission(
      opsSession(CLINIC_ROLE.DOCTOR),
      CLINIC_PERMISSION.API_SANATORIUM_RESOURCES,
    );
    expect(res?.status).toBe(403);
  });

  it("RECEPTION without api:sanatorium.nurse_roster is 403", async () => {
    mockStoredPermissions(
      CLINIC_ROLE.RECEPTION,
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.RECEPTION],
    );
    const res = await assertClinicPermission(
      opsSession(CLINIC_ROLE.RECEPTION),
      CLINIC_PERMISSION.API_SANATORIUM_NURSE_ROSTER,
    );
    expect(res?.status).toBe(403);
  });

  it("session without api:procedures.reception is 403", async () => {
    mockStoredPermissions(
      CLINIC_ROLE.NURSE,
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.NURSE],
    );
    const res = await assertClinicPermission(
      opsSession(CLINIC_ROLE.NURSE),
      CLINIC_PERMISSION.API_PROCEDURES_RECEPTION,
    );
    expect(res?.status).toBe(403);
  });

  it("returns 401 when session is missing", async () => {
    const res = await assertClinicPermission(
      null,
      CLINIC_PERMISSION.API_SANATORIUM_RESOURCES,
    );
    expect(res?.status).toBe(401);
  });
});
