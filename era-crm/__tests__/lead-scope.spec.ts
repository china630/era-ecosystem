/**
 * CRM-SCOPE-01: resolveLeadScopeFromGrants + assertLeadInScope deny path.
 */
jest.mock("@/lib/prisma", () => ({
  prisma: {
    lead: { findFirst: jest.fn() },
    userGroupMember: { findMany: jest.fn() },
  },
}));

import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  applyOwnerListFilter,
  assertLeadInScope,
  resolveLeadScopeFromGrants,
} from "@/lib/integrations/lead-scope";
import { prisma } from "@/lib/prisma";

describe("resolveLeadScopeFromGrants", () => {
  it("defaults agent without assign to group (not all)", () => {
    expect(
      resolveLeadScopeFromGrants({
        permissions: [PERMISSIONS.LEADS_READ],
      }),
    ).toBe("group");
  });

  it("gives all when LEADS_ASSIGN present", () => {
    expect(
      resolveLeadScopeFromGrants({
        permissions: [PERMISSIONS.LEADS_ASSIGN],
      }),
    ).toBe("all");
  });

  it("does not elevate to all via LEADS_EXPORT alone", () => {
    expect(
      resolveLeadScopeFromGrants({
        permissions: [PERMISSIONS.LEADS_READ, PERMISSIONS.LEADS_EXPORT],
      }),
    ).toBe("group");
  });

  it("denies requested all without capability → group", () => {
    expect(
      resolveLeadScopeFromGrants({
        permissions: [PERMISSIONS.LEADS_READ],
        queryScope: "all",
      }),
    ).toBe("group");
  });
});

describe("assertLeadInScope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.userGroupMember.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("throws PermissionDeniedError when lead outside own scope", async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);
    await expect(
      assertLeadInScope({
        organizationId: "org1",
        userId: "u1",
        leadId: "lead-other",
        permissions: [PERMISSIONS.LEADS_READ],
      }),
    ).rejects.toMatchObject({ name: "PermissionDeniedError" });
  });

  it("passes when lead is in scope", async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue({ id: "lead1" });
    await expect(
      assertLeadInScope({
        organizationId: "org1",
        userId: "u1",
        leadId: "lead1",
        permissions: [PERMISSIONS.LEADS_ASSIGN],
      }),
    ).resolves.toBeUndefined();
  });
});

describe("applyOwnerListFilter", () => {
  it("rejects query ownerId outside group peer set", async () => {
    await expect(
      applyOwnerListFilter({
        scopeWhere: { organizationId: "org1", ownerId: { in: ["u1", "u2"] } },
        scope: "group",
        sessionUserId: "u1",
        queryOwnerId: "u-outsider",
      }),
    ).rejects.toMatchObject({ name: "PermissionDeniedError" });
  });

  it("intersects query ownerId inside group", async () => {
    const where = await applyOwnerListFilter({
      scopeWhere: { organizationId: "org1", ownerId: { in: ["u1", "u2"] } },
      scope: "group",
      sessionUserId: "u1",
      queryOwnerId: "u2",
    });
    expect(where.ownerId).toBe("u2");
  });

  it("allows mine to narrow to session user", async () => {
    const where = await applyOwnerListFilter({
      scopeWhere: { organizationId: "org1", ownerId: { in: ["u1", "u2"] } },
      scope: "group",
      sessionUserId: "u1",
      mine: true,
      queryOwnerId: "u2",
    });
    expect(where.ownerId).toBe("u1");
  });
});
