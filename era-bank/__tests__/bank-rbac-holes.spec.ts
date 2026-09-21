import { PERMISSIONS, tellerPermissions } from "@/lib/auth/permissions";
import { requiredPermissionsForEngineProxy } from "@/lib/auth/bff-permission-map";
import {
  sessionHasBankPermission,
  type BankPermissionSession,
} from "@/lib/auth/permission-check";

function tellerSession(): BankPermissionSession {
  return {
    login: "teller-a",
    role: "TELLER",
    permissions: tellerPermissions(),
  };
}

describe("bank rbac hole-close", () => {
  it("pricing-approve is deposits.approve not write", () => {
    expect(
      requiredPermissionsForEngineProxy({
        enginePrefix: "deposits",
        method: "POST",
        pathSegments: ["id", "pricing-approve"],
      }),
    ).toEqual([PERMISSIONS.DEPOSITS_APPROVE]);
    expect(
      requiredPermissionsForEngineProxy({
        enginePrefix: "loans",
        method: "POST",
        pathSegments: ["id", "pricing-reject"],
      }),
    ).toEqual([PERMISSIONS.LOANS_REJECT]);
  });

  it("teller cannot pricing-approve via write grant", () => {
    const t = tellerSession();
    const needed = requiredPermissionsForEngineProxy({
      enginePrefix: "deposits",
      method: "POST",
      pathSegments: ["id", "pricing-approve"],
    });
    expect(needed.some((p) => sessionHasBankPermission(t, p))).toBe(false);
    expect(sessionHasBankPermission(t, PERMISSIONS.DEPOSITS_WRITE)).toBe(true);
  });

  it("teller can GET product-templates (account open picker)", () => {
    const t = tellerSession();
    const needed = requiredPermissionsForEngineProxy({
      enginePrefix: "product-templates",
      method: "GET",
      pathSegments: [],
    });
    expect(needed.some((p) => sessionHasBankPermission(t, p))).toBe(true);
  });

  it("teller cannot mutate product-templates", () => {
    const t = tellerSession();
    const needed = requiredPermissionsForEngineProxy({
      enginePrefix: "product-templates",
      method: "POST",
      pathSegments: [],
    });
    expect(needed.some((p) => sessionHasBankPermission(t, p))).toBe(false);
  });

  it("unknown engine prefix is fail-closed", () => {
    expect(
      requiredPermissionsForEngineProxy({
        enginePrefix: "secret-module",
        method: "GET",
        pathSegments: [],
      }),
    ).toEqual([]);
    expect(
      requiredPermissionsForEngineProxy({
        enginePrefix: "secret-module",
        method: "POST",
        pathSegments: ["approve"],
      }),
    ).toEqual([]);
  });

  it("aml cannot cards GET", () => {
    const aml: BankPermissionSession = {
      login: "compliance",
      role: "AML_OFFICER",
      permissions: [PERMISSIONS.AML_READ, PERMISSIONS.SCREEN_AML],
    };
    const needed = requiredPermissionsForEngineProxy({
      enginePrefix: "cards",
      method: "GET",
      pathSegments: [],
    });
    expect(needed.some((p) => sessionHasBankPermission(aml, p))).toBe(false);
  });
});
