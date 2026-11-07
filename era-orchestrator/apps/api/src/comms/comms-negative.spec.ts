import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { CommsService } from "./comms.service";

describe("CommsService negatives (CP-COMMS-01)", () => {
  function makeSvc(prisma: Record<string, unknown>) {
    return new CommsService(
      prisma as never,
      { send: jest.fn() } as never,
      { enqueueOutbox: jest.fn() } as never,
    );
  }

  it("rejects empty recipients with 400", async () => {
    const prisma = {
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ userId: "u1" }),
      },
    };
    const svc = makeSvc(prisma);
    await expect(
      svc.createThread("org-1", "u1", {
        subject: "Hi",
        body: "Body",
        recipientUserIds: [],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects self-only recipients with 400", async () => {
    const prisma = {
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ userId: "u1" }),
      },
    };
    const svc = makeSvc(prisma);
    await expect(
      svc.createThread("org-1", "u1", {
        subject: "Hi",
        body: "Body",
        recipientUserIds: ["u1"],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects cross-org recipient with 403", async () => {
    const prisma = {
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ userId: "u1" }),
        findMany: jest.fn().mockResolvedValue([{ userId: "u2" }]),
      },
    };
    const svc = makeSvc(prisma);
    await expect(
      svc.createThread("org-1", "u1", {
        subject: "Hi",
        body: "Body",
        recipientUserIds: ["u2", "u3"],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("rejects getThread for non-participant with 403", async () => {
    const prisma = {
      organizationMembership: {
        findFirst: jest.fn().mockResolvedValue({ userId: "u1" }),
      },
      commsThread: {
        findFirst: jest.fn().mockResolvedValue({
          id: "t1",
          organizationId: "org-1",
          participants: [{ userId: "u2", readAt: null }],
          messages: [],
        }),
      },
    };
    const svc = makeSvc(prisma);
    await expect(svc.getThread("org-1", "u1", "t1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
