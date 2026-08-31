import { changeLocalPassword, LocalPasswordError } from "@/lib/change-local-password";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

describe("clinic changeLocalPassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects SSO accounts", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      status: "ACTIVE",
      passwordHash: "sso:no-password",
    });
    await expect(
      changeLocalPassword({
        userId: "u1",
        currentPassword: "anything",
        newPassword: "newpass12",
      }),
    ).rejects.toMatchObject({ name: "LocalPasswordError", status: 403 });
  });

  it("rejects wrong current password", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      status: "ACTIVE",
      passwordHash: "salt:0000",
    });
    await expect(
      changeLocalPassword({
        userId: "u1",
        currentPassword: "wrong",
        newPassword: "newpass12",
      }),
    ).rejects.toBeInstanceOf(LocalPasswordError);
  });

  it("updates hash when current PIN matches", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.user.findUnique.mockResolvedValue({
      id: "u1",
      status: "ACTIVE",
      passwordHash: "salt:0000",
    });
    prisma.user.update.mockResolvedValue({ id: "u1" });
    await changeLocalPassword({
      userId: "u1",
      currentPassword: "0000",
      newPassword: "newpass12",
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: { passwordHash: "salt:newpass12" },
      }),
    );
  });
});
