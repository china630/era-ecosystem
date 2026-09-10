import {
  CLINIC_PERMISSION,
  DEFAULT_ROLE_PERMISSIONS,
  defaultPermissionsForRole,
  serializeRolePermissions,
  parseRolePermissions,
} from "@/lib/auth/clinic-permissions";
import { ensureSystemClinicRoles } from "@/lib/auth/ensure-system-clinic-roles";
import { CLINIC_ROLE, SYSTEM_CLINIC_ROLES } from "@/lib/clinic-roles";

describe("ensureSystemClinicRoles", () => {
  function makeDb(seed: Array<{ code: string; permissionsJson: string; staffKind?: string | null }>) {
    const store = new Map(
      seed.map((r) => [
        r.code,
        {
          id: `id-${r.code}`,
          organizationId: "org-1",
          code: r.code,
          name: r.code,
          permissionsJson: r.permissionsJson,
          isSystem: false,
          staffKind: r.staffKind ?? null,
          cloneFromCode: null,
        },
      ]),
    );
    return {
      role: {
        findFirst: jest.fn(async ({ where }: { where: { code: string } }) => {
          return store.get(where.code) ?? null;
        }),
        create: jest.fn(async ({ data }: { data: { code: string; permissionsJson: string } }) => {
          const row = {
            id: `id-${data.code}`,
            organizationId: "org-1",
            name: data.code,
            isSystem: true,
            staffKind: null as string | null,
            cloneFromCode: null,
            ...data,
          };
          store.set(data.code, row);
          return row;
        }),
        update: jest.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const found = [...store.values()].find((r) => r.id === where.id);
            if (!found) throw new Error("missing");
            Object.assign(found, data);
            return found;
          },
        ),
      },
      store,
    };
  }

  it("creates all six system roles when empty", async () => {
    const db = makeDb([]);
    await ensureSystemClinicRoles(db, "org-1");
    expect(db.role.create).toHaveBeenCalledTimes(SYSTEM_CLINIC_ROLES.length);
    for (const code of SYSTEM_CLINIC_ROLES) {
      expect(db.store.has(code)).toBe(true);
      expect(db.store.get(code)!.isSystem).toBe(true);
    }
  });

  it("does not overwrite customized permissionsJson", async () => {
    const custom = serializeRolePermissions([
      CLINIC_PERMISSION.SCREEN_HOME,
      CLINIC_PERMISSION.API_CASHIER,
    ]);
    const db = makeDb([
      { code: CLINIC_ROLE.RECEPTION, permissionsJson: custom, staffKind: "NONE" },
    ]);
    await ensureSystemClinicRoles(db, "org-1");
    expect(db.store.get(CLINIC_ROLE.RECEPTION)!.permissionsJson).toBe(custom);
    const receptionUpdates = (db.role.update as jest.Mock).mock.calls.filter(
      (c) => c[0].where.id === "id-RECEPTION",
    );
    for (const call of receptionUpdates) {
      expect(call[0].data.permissionsJson).toBeUndefined();
    }
  });

  it("fills empty permissionsJson from template", async () => {
    const db = makeDb([
      { code: CLINIC_ROLE.DOCTOR, permissionsJson: "[]", staffKind: null },
    ]);
    await ensureSystemClinicRoles(db, "org-1");
    const doctor = db.store.get(CLINIC_ROLE.DOCTOR)!;
    expect(parseRolePermissions(doctor.permissionsJson).length).toBeGreaterThan(0);
    expect(doctor.staffKind).toBe("DOCTOR");
    expect(doctor.isSystem).toBe(true);
  });
});

describe("defaultPermissionsForRole / chief doctor model", () => {
  it("unknown role code does not invent RECEPTION grants", () => {
    const perms = defaultPermissionsForRole("CHIEF_DOCTOR");
    expect(perms).toEqual([CLINIC_PERMISSION.SCREEN_HOME]);
    expect(perms).not.toContain(CLINIC_PERMISSION.API_CASHIER);
  });

  it("chief doctor = doctor defaults + scope all + patients", () => {
    const chief = new Set([
      ...DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR],
      CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
      CLINIC_PERMISSION.SCREEN_PATIENTS,
    ]);
    expect(chief.has(CLINIC_PERMISSION.SCOPE_EPISODES_ALL)).toBe(true);
    expect(chief.has(CLINIC_PERMISSION.SCREEN_DOCTOR)).toBe(true);
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.DOCTOR].includes(
        CLINIC_PERMISSION.SCOPE_EPISODES_ALL,
      ),
    ).toBe(false);
  });

  it("FO manager is permission-only (no CLINIC_ADMIN role bypass in catalog)", () => {
    expect(
      DEFAULT_ROLE_PERMISSIONS[CLINIC_ROLE.CLINIC_ADMIN],
    ).toContain(CLINIC_PERMISSION.API_PROCEDURES_FO_MANAGER);
    // Capability key exists independently of role name checks in UI.
    expect(CLINIC_PERMISSION.API_PROCEDURES_FO_MANAGER).toBe(
      "api:procedures.fo_manager",
    );
  });
});
