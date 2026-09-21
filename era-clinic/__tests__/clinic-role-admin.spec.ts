import {
  canDeleteClinicRole,
  canMutateCustomRoleMeta,
  isValidCustomClinicRoleCode,
  normalizeClinicRoleCode,
  parseAssignableStaffKind,
} from "@/lib/auth/clinic-role-admin";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { adminApiRoutePermission, CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";

describe("clinic-role-admin helpers", () => {
  it("rejects reserved system codes for custom create", () => {
    expect(isValidCustomClinicRoleCode("DOCTOR")).toBe(false);
    expect(isValidCustomClinicRoleCode("CLINIC_ADMIN")).toBe(false);
    expect(isValidCustomClinicRoleCode("CHIEF_DOCTOR")).toBe(true);
    expect(isValidCustomClinicRoleCode("chief_doctor")).toBe(false);
    expect(isValidCustomClinicRoleCode(normalizeClinicRoleCode("chief_doctor"))).toBe(
      true,
    );
  });

  it("blocks staffKind/name mutate on system roles", () => {
    expect(
      canMutateCustomRoleMeta({ isSystem: true, code: CLINIC_ROLE.DOCTOR }),
    ).toBe(false);
    expect(
      canMutateCustomRoleMeta({ isSystem: false, code: "CHIEF_DOCTOR" }),
    ).toBe(true);
  });

  it("delete rules: system forbidden; users block; empty custom ok", () => {
    expect(
      canDeleteClinicRole({
        isSystem: true,
        code: CLINIC_ROLE.RECEPTION,
        userCount: 0,
      }),
    ).toEqual({ ok: false, reason: "system" });
    expect(
      canDeleteClinicRole({
        isSystem: false,
        code: "CHIEF_DOCTOR",
        userCount: 2,
      }),
    ).toEqual({ ok: false, reason: "has_users" });
    expect(
      canDeleteClinicRole({
        isSystem: false,
        code: "CHIEF_DOCTOR",
        userCount: 0,
      }),
    ).toEqual({ ok: true });
  });

  it("parses staffKind whitelist", () => {
    expect(parseAssignableStaffKind("DOCTOR")).toBe("DOCTOR");
    expect(parseAssignableStaffKind("NURSE")).toBe("NURSE");
    expect(parseAssignableStaffKind("LAB")).toBe("LAB");
    expect(parseAssignableStaffKind("NONE")).toBe("NONE");
    expect(parseAssignableStaffKind("FLOOR")).toBeNull();
  });

  it("admin API maps /api/admin/users to access screen", () => {
    expect(adminApiRoutePermission("/api/admin/users")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS,
    );
    expect(adminApiRoutePermission("/api/admin/users/abc")).toBe(
      CLINIC_PERMISSION.SCREEN_ADMIN_ACCESS,
    );
  });
});
