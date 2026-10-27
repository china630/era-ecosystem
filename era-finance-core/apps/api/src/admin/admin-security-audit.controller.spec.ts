import { ForbiddenException } from "@nestjs/common";
import { AdminSecurityAuditController } from "./admin-security-audit.controller";
import type { AdminAuditLogsService } from "./audit.service";
import type { AuthUser } from "../auth/types/auth-user";

describe("AdminSecurityAuditController OWNER door", () => {
  const adminAuditLogs = {
    listAuditLogs: jest.fn().mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
    }),
  } as unknown as AdminAuditLogsService;

  const controller = new AdminSecurityAuditController(adminAuditLogs);

  function user(partial: Partial<AuthUser>): AuthUser {
    return {
      userId: "u-1",
      organizationId: "org-1",
      role: "USER",
      permissions: [],
      isOwner: false,
      isSuperAdmin: false,
      ...partial,
    } as AuthUser;
  }

  it("rejects ledger-read non-owner", async () => {
    await expect(
      controller.list(user({ isOwner: false, isSuperAdmin: false }), "org-1", {
        page: 1,
        pageSize: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(adminAuditLogs.listAuditLogs).not.toHaveBeenCalled();
  });

  it("allows OWNER without SuperAdmin", async () => {
    await expect(
      controller.list(user({ isOwner: true, isSuperAdmin: false }), "org-1", {
        page: 1,
        pageSize: 20,
      }),
    ).resolves.toMatchObject({ total: 0, page: 1 });
    expect(adminAuditLogs.listAuditLogs).toHaveBeenCalledWith(
      "org-1",
      expect.objectContaining({ page: 1, pageSize: 20 }),
    );
  });
});
