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
  navEntryPermission,
  opsApiRoutePermission,
} from "@/lib/auth/clinic-permissions";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { assertClinicPermission } from "@/lib/auth/clinic-permission.service";
import { buildClinicNav, CLINIC_NAV, CLINIC_TOP_NAV } from "@/domain/nav/clinic-nav";

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

describe("Clinic RBAC ops API catalog (Wave 3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("no api:patients → 403", async () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.RECEPTION].filter(
      (p) => p !== CLINIC_PERMISSION.API_PATIENTS,
    );
    mockStoredPermissions(CLINIC_ROLE.RECEPTION, perms);
    const res = await assertClinicPermission(
      opsSession(CLINIC_ROLE.RECEPTION),
      CLINIC_PERMISSION.API_PATIENTS,
    );
    expect(res?.status).toBe(403);
  });

  it("no api:appointments.write → 403", async () => {
    mockStoredPermissions(
      CLINIC_ROLE.DOCTOR,
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR],
    );
    const res = await assertClinicPermission(
      opsSession(CLINIC_ROLE.DOCTOR),
      CLINIC_PERMISSION.API_APPOINTMENTS_WRITE,
    );
    expect(res?.status).toBe(403);
  });

  it("no api:lab_orders → 403 on collect capability", async () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.LAB_TECH].filter(
      (p) => p !== CLINIC_PERMISSION.API_LAB_ORDERS,
    );
    mockStoredPermissions(CLINIC_ROLE.LAB_TECH, perms);
    const res = await assertClinicPermission(
      opsSession(CLINIC_ROLE.LAB_TECH),
      CLINIC_PERMISSION.API_LAB_ORDERS,
    );
    expect(res?.status).toBe(403);
  });

  it("no api:procedures.confirm → 403", async () => {
    mockStoredPermissions(
      CLINIC_ROLE.NURSE,
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.NURSE],
    );
    const res = await assertClinicPermission(
      opsSession(CLINIC_ROLE.NURSE),
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    expect(res?.status).toBe(403);
  });

  it("no api:queue → 403", async () => {
    mockStoredPermissions(
      CLINIC_ROLE.DOCTOR,
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR],
    );
    const res = await assertClinicPermission(
      opsSession(CLINIC_ROLE.DOCTOR),
      CLINIC_PERMISSION.API_QUEUE,
    );
    expect(res?.status).toBe(403);
  });

  it("opsApiRoutePermission maps staff prefixes", () => {
    expect(opsApiRoutePermission("/api/patients")).toBe(
      CLINIC_PERMISSION.API_PATIENTS,
    );
    expect(opsApiRoutePermission("/api/queue/tickets")).toBe(
      CLINIC_PERMISSION.API_QUEUE,
    );
    expect(opsApiRoutePermission("/api/lab-orders/x/collect")).toBe(
      CLINIC_PERMISSION.API_LAB_ORDERS,
    );
    expect(opsApiRoutePermission("/api/lab/import")).toBe(
      CLINIC_PERMISSION.API_LAB_ORDERS,
    );
    expect(opsApiRoutePermission("/api/imaging-phrases")).toBe(
      CLINIC_PERMISSION.API_CATALOG_READ,
    );
    expect(opsApiRoutePermission("/api/templates")).toBeNull();
    expect(opsApiRoutePermission("/api/cashier/queue")).toBe(
      CLINIC_PERMISSION.API_CASHIER,
    );
    expect(opsApiRoutePermission("/api/procedures/confirm")).toBe(
      CLINIC_PERMISSION.API_PROCEDURES_CONFIRM,
    );
    expect(opsApiRoutePermission("/api/procedures/x/complete")).toBe(
      CLINIC_PERMISSION.API_PROCEDURES_READ,
    );
  });

  it("navEntryPermission returns entry.permission", () => {
    const entry = CLINIC_TOP_NAV.find((e) => e.href === "/patients");
    expect(entry).toBeDefined();
    expect(navEntryPermission(entry!)).toBe(CLINIC_PERMISSION.SCREEN_PATIENTS);
  });

  it("buildClinicNav hides patients when permission absent", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.RECEPTION].filter(
      (p) => p !== CLINIC_PERMISSION.SCREEN_PATIENTS,
    );
    const nav = buildClinicNav(
      {
        role: CLINIC_ROLE.RECEPTION,
        permissions: perms,
        presetEnabled: () => true,
      },
      (key) => key,
    );
    const hrefs = [
      ...nav.topItems.map((i) => i.href),
      ...nav.sections.flatMap((s) => s.items.map((i) => i.href)),
    ];
    expect(hrefs).not.toContain("/patients");
  });
});

describe("staff route grep gate (gap closeout)", () => {
  const fs = require("fs") as typeof import("fs");
  const path = require("path") as typeof import("path");

  const ALLOW_PREFIXES = [
    "/auth/login",
    "/auth/logout",
    "/auth/sso",
    "/auth/password",
    "/auth/me",
    "/auth/session/refresh-permissions",
    "/internal/",
    "/cron/",
    "/integration/",
    "/portal/",
    "/booking/",
    "/sanatorium/episodes/from-stay",
    "/platform/billing-snapshot",
    "/executive/summary",
    "/capacity/summary",
    "/events/dispatch",
    "/locale",
    "/health",
    "/ready",
  ];

  const GUARD_MARKERS = [
    "requireClinicPermission",
    "assertOpsApiPermission",
    "assertClinicAdminRoute",
    "assertClinicImportAccess",
  ];

  function walk(dir: string, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p, out);
      else if (ent.name === "route.ts") out.push(p);
    }
    return out;
  }

  function apiRel(apiRoot: string, file: string): string {
    return (
      "/" +
      path
        .relative(apiRoot, file)
        .replace(/\\/g, "/")
        .replace(/\/route\.ts$/, "")
    );
  }

  function isAllowed(rel: string): boolean {
    return ALLOW_PREFIXES.some(
      (pref) =>
        rel === pref ||
        rel.startsWith(pref) ||
        (pref.endsWith("/") && rel.startsWith(pref)),
    );
  }

  it("every non-allowlisted staff route.ts has a permission/service gate marker", () => {
    const apiRoot = path.join(__dirname, "..", "app", "api");
    const missing: string[] = [];
    for (const file of walk(apiRoot)) {
      const rel = apiRel(apiRoot, file);
      if (isAllowed(rel)) continue;
      const src = fs.readFileSync(file, "utf8");
      if (!GUARD_MARKERS.some((m) => src.includes(m))) {
        missing.push(rel);
      }
    }
    expect(missing).toEqual([]);
  });
});
