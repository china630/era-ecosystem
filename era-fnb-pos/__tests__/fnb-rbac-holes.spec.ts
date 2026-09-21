import {
  PERMISSIONS,
  waiterPermissions,
  kitchenPermissions,
} from "@/lib/auth/permissions";
import {
  sessionHasFnbPermission,
  type FnbPermissionSession,
} from "@/lib/auth/permission-check";
import {
  TILL_READ_MENU,
  TILL_READ_TICKETS,
  ROSTER_WRITE,
} from "@/lib/auth/read-permission-sets";

function kitchenSession(): FnbPermissionSession {
  return {
    login: "kit",
    role: "FB_KITCHEN",
    permissions: kitchenPermissions(),
    pin: true,
  };
}

function waiterHotel(): FnbPermissionSession {
  return {
    login: "w",
    role: "FB_WAITER",
    permissions: waiterPermissions("hotel"),
  };
}

describe("fnb rbac hole-close read sets", () => {
  it("kitchen cannot read ticket list or menu admin", () => {
    const k = kitchenSession();
    expect(
      TILL_READ_TICKETS.some((p) => sessionHasFnbPermission(k, p)),
    ).toBe(false);
    expect(
      TILL_READ_MENU.some((p) => sessionHasFnbPermission(k, p)),
    ).toBe(false);
    expect(sessionHasFnbPermission(k, PERMISSIONS.KDS_BUMP)).toBe(true);
  });

  it("hotel waiter can read tickets and menu but not void", () => {
    const w = waiterHotel();
    expect(
      TILL_READ_TICKETS.some((p) => sessionHasFnbPermission(w, p)),
    ).toBe(true);
    expect(
      TILL_READ_MENU.some((p) => sessionHasFnbPermission(w, p)),
    ).toBe(true);
    expect(sessionHasFnbPermission(w, PERMISSIONS.TICKETS_VOID)).toBe(false);
    expect(sessionHasFnbPermission(w, PERMISSIONS.OUTLET_BIND)).toBe(false);
  });

  it("PIN session never bypasses even with isOwner", () => {
    const pinOwner: FnbPermissionSession = {
      login: "owner",
      role: "BUSINESS_OWNER",
      isOwner: true,
      pin: true,
      permissions: [],
    };
    expect(sessionHasFnbPermission(pinOwner, PERMISSIONS.TICKETS_VOID)).toBe(
      false,
    );
  });

  it("roster write accepts STAFF_PIN or LABOR_ROSTER_WRITE", () => {
    const staffOnly: FnbPermissionSession = {
      login: "m",
      role: "FB_MANAGER",
      permissions: [PERMISSIONS.STAFF_PIN],
    };
    const writeOnly: FnbPermissionSession = {
      login: "m",
      role: "CUSTOM",
      permissions: [PERMISSIONS.LABOR_ROSTER_WRITE],
    };
    expect(ROSTER_WRITE.some((p) => sessionHasFnbPermission(staffOnly, p))).toBe(
      true,
    );
    expect(ROSTER_WRITE.some((p) => sessionHasFnbPermission(writeOnly, p))).toBe(
      true,
    );
  });

  it("kafe waiter lacks pay grant", () => {
    const w: FnbPermissionSession = {
      login: "w",
      role: "FB_WAITER",
      permissions: waiterPermissions("kafe"),
      pin: true,
    };
    expect(sessionHasFnbPermission(w, PERMISSIONS.TICKETS_PAY)).toBe(false);
  });
});
