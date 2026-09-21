import {
  LEGACY_BARE_PERMISSION_CODES,
  PERMISSIONS,
} from "../../../../packages/database/prisma/seeds/core/rbac/permissions.data";
import { ROLE_PERMISSION_MATRIX } from "../../../../packages/database/prisma/seeds/core/rbac/matrix.data";

describe("Finance Prisma RBAC seed (not AuthZ door)", () => {
  it("catalog codes are CP api:/admin: keys only", () => {
    for (const row of PERMISSIONS) {
      expect(row.code.startsWith("api:") || row.code.startsWith("admin:")).toBe(
        true,
      );
    }
  });

  it("legacy bare codes are retired and never re-listed in PERMISSIONS", () => {
    const live = new Set<string>(PERMISSIONS.map((p) => p.code));
    for (const code of LEGACY_BARE_PERMISSION_CODES) {
      expect(code.includes(":")).toBe(false);
      expect(live.has(code)).toBe(false);
    }
  });

  it("role matrix only references catalog keys", () => {
    const live = new Set<string>(PERMISSIONS.map((p) => p.code));
    for (const codes of Object.values(ROLE_PERMISSION_MATRIX)) {
      for (const code of codes) {
        expect(live.has(code)).toBe(true);
      }
    }
  });
});
