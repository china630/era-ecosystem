import {
  CLINIC_PERMISSION,
  DEFAULT_ROLE_PERMISSIONS,
  routePermission,
  adminApiRoutePermission,
  migrateStoredPermissions,
} from "@/lib/auth/clinic-permissions";
import { CLINIC_NAV, CLINIC_TOP_NAV } from "@/domain/nav/clinic-nav";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { sessionHasClinicPermission } from "@/lib/auth/clinic-permission-check";

describe("clinic default permissions", () => {
  it("RECEPTION sees sanatorium resources but not nurse roster screen", () => {
    const session = {
      role: CLINIC_ROLE.RECEPTION,
      login: "reception",
      permissions: DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.RECEPTION],
    };
    expect(
      sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_SANATORIUM_RESOURCES),
    ).toBe(true);
    expect(
      sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_SANATORIUM_NURSE_ROSTER),
    ).toBe(false);
  });

  it("DOCTOR sees nurse roster but not resource matrix", () => {
    const session = {
      role: CLINIC_ROLE.DOCTOR,
      login: "doctor",
      permissions: DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR],
    };
    expect(
      sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_SANATORIUM_NURSE_ROSTER),
    ).toBe(true);
    expect(
      sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_SANATORIUM_RESOURCES),
    ).toBe(false);
  });

  it("nav screen permissions align with role defaults", () => {
    for (const entry of [...CLINIC_TOP_NAV, ...CLINIC_NAV]) {
      if (!entry.permission) continue;
      // Every configurable ops role that should see the screen holds the permission in defaults
      // (CLINIC_ADMIN holds ALL). Spot-check: permission appears in at least one non-admin default
      // OR is an admin screen (screen:admin.* / admin:access_manage).
      const isAdmin =
        entry.permission.startsWith("screen:admin.") ||
        entry.permission === CLINIC_PERMISSION.ADMIN_ACCESS_MANAGE;
      if (isAdmin) {
        expect(
          DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.CLINIC_ADMIN],
        ).toContain(entry.permission);
        continue;
      }
      const holders = Object.entries(DEFAULT_ROLE_PERMISSIONS).filter(
        ([, perms]) => perms.includes(entry.permission!),
      );
      expect(holders.length).toBeGreaterThan(0);
    }
  });

  it("routePermission maps key sanatorium paths", () => {
    expect(routePermission("/sanatorium/resources")).toBe(
      CLINIC_PERMISSION.SCREEN_SANATORIUM_RESOURCES,
    );
    expect(routePermission("/sanatorium/nurse-roster")).toBe(
      CLINIC_PERMISSION.SCREEN_SANATORIUM_NURSE_ROSTER,
    );
    expect(routePermission("/doctor")).toBe(CLINIC_PERMISSION.SCREEN_DOCTOR);
  });

  it("routePermission maps admin screens", () => {
    expect(routePermission("/admin/catalog")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
    );
    expect(routePermission("/admin/access")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS,
    );
    expect(routePermission("/admin/diagnostic-catalog")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG,
    );
    expect(routePermission("/admin/program-templates")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
    );
    expect(routePermission("/admin/templates")).not.toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
    );
  });

  it("adminApiRoutePermission maps program-templates and diagnostic catalog", () => {
    expect(adminApiRoutePermission("/api/admin/program-templates")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
    );
    expect(adminApiRoutePermission("/api/admin/program-templates/x")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES,
    );
    expect(adminApiRoutePermission("/api/admin/diagnostic-catalog/services")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG,
    );
    expect(adminApiRoutePermission("/api/admin/clinical-templates")).toBeNull();
  });

  it("CLINIC_ADMIN defaults include program templates and not legacy templates key", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.CLINIC_ADMIN];
    expect(perms).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES);
    expect(perms).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG);
    expect(perms).not.toContain("screen:admin.templates" as never);
  });

  it("migrateStoredPermissions expands legacy screen:admin.templates", () => {
    const next = migrateStoredPermissions(["screen:admin.templates", "screen:home"]);
    expect(next).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_DIAGNOSTIC_CATALOG);
    expect(next).toContain(CLINIC_PERMISSION.SCREEN_ADMIN_PROGRAM_TEMPLATES);
    expect(next).toContain(CLINIC_PERMISSION.SCREEN_HOME);
    expect(next).not.toContain("screen:admin.templates" as never);
  });

  it("adminApiRoutePermission longest-prefix maps admin APIs", () => {
    expect(adminApiRoutePermission("/api/admin/catalog")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_CATALOG,
    );
    expect(adminApiRoutePermission("/api/admin/catalog/import-nafta")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_IMPORT,
    );
    expect(adminApiRoutePermission("/api/admin/roles/CLINIC_ADMIN/permissions")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS,
    );
  });

  it("CLINIC_ADMIN role alone does not bypass sessionHasClinicPermission", () => {
    expect(
      sessionHasClinicPermission(
        {
          role: CLINIC_ROLE.CLINIC_ADMIN,
          login: "admin",
          permissions: [CLINIC_PERMISSION.SCREEN_HOME],
        },
        CLINIC_PERMISSION.SCREEN_ADMIN_SETTINGS,
      ),
    ).toBe(false);
  });

  it("RECEPTION defaults include staff absences and episode read+write", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.RECEPTION];
    expect(perms).toContain(CLINIC_PERMISSION.API_SANATORIUM_STAFF_ABSENCES);
    expect(perms).toContain(CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ);
    expect(perms).toContain(CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE);
  });

  it("DOCTOR defaults include episode read+write", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR];
    expect(perms).toContain(CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ);
    expect(perms).toContain(CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE);
  });

  it("NURSE has episode read but not write", () => {
    const perms = DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.NURSE];
    expect(perms).toContain(CLINIC_PERMISSION.API_SANATORIUM_EPISODES_READ);
    expect(perms).not.toContain(CLINIC_PERMISSION.API_SANATORIUM_EPISODES_WRITE);
  });
});
