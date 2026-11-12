import { BadRequestException, NotFoundException } from "@nestjs/common";
import { OrgAccessCredentialService } from "./org-access-credential.service";

describe("OrgAccessCredentialService", () => {
  const prisma = {
    organization: { findUnique: jest.fn() },
    organizationAccessCredential: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };

  const orgId = "11111111-1111-1111-1111-111111111111";

  function svc() {
    return new OrgAccessCredentialService(prisma as never);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.organization.findUnique.mockResolvedValue({ id: orgId });
    prisma.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma));
    prisma.organizationAccessCredential.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: "row-1", ...data }),
    );
    prisma.auditLog.create.mockResolvedValue({ id: "audit" });
  });

  it("lists catalog rows without returning a secret", async () => {
    prisma.organizationAccessCredential.findMany.mockResolvedValue([
      {
        connectorCode: "BANK_PASHA",
        publicFields: { clientId: "cid" },
        secretCipher: "v1.cipher.not.plaintext",
      },
    ]);
    const { items } = await svc().list(orgId);
    const pasha = items.find((row) => row.code === "BANK_PASHA");
    expect(pasha?.secretSet).toBe(true);
    expect(pasha?.publicFields).toEqual({ clientId: "cid" });
    expect(JSON.stringify(pasha)).not.toContain("plaintext");
    expect(items.find((row) => row.code === "BANK_UNIBANK")?.active).toBe(false);
  });

  it("refuses a bank that has no platform adapter", async () => {
    await expect(
      svc().upsert(orgId, "BANK_UNIBANK", { publicFields: { clientId: "x" }, secret: "s" }, "actor"),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.organizationAccessCredential.create).not.toHaveBeenCalled();
  });

  it("stores a cipher for the org and does not persist the raw secret", async () => {
    prisma.organizationAccessCredential.findUnique.mockResolvedValue(null);
    const saved = await svc().upsert(
      orgId,
      "BANK_PASHA",
      { publicFields: { clientId: "cid" }, secret: "raw-secret" },
      "actor-1",
    );
    const arg = prisma.organizationAccessCredential.create.mock.calls[0][0].data;
    expect(arg.organizationId).toBe(orgId);
    expect(arg.secretCipher).not.toContain("raw-secret");
    expect(arg.secretCipher.startsWith("v1.")).toBe(true);
    expect(saved.secretSet).toBe(true);
    expect(JSON.stringify(saved)).not.toContain("raw-secret");
    const audit = prisma.auditLog.create.mock.calls[0][0].data;
    expect(audit.userId).toBe("actor-1");
    expect(JSON.stringify(audit.newValues)).not.toContain("raw-secret");
  });

  it("refuses a save with no id and no secret", async () => {
    prisma.organizationAccessCredential.findUnique.mockResolvedValue(null);
    await expect(svc().upsert(orgId, "BANK_PASHA", { publicFields: {} }, "actor")).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.organizationAccessCredential.create).not.toHaveBeenCalled();
  });

  it("check reports stored and does not claim an external call", async () => {
    prisma.organizationAccessCredential.findUnique.mockResolvedValue({ id: "row" });
    await expect(svc().checkStored(orgId, "GOV_EMAS")).resolves.toEqual({
      status: "stored",
      calledExternal: false,
    });
  });

  it("check 404 when this org has no saved key", async () => {
    prisma.organizationAccessCredential.findUnique.mockResolvedValue(null);
    await expect(svc().checkStored(orgId, "GOV_EMAS")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("service resolve refuses an inactive bank", async () => {
    await expect(svc().resolveForService(orgId, "BANK_UNIBANK")).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.organizationAccessCredential.findUnique).not.toHaveBeenCalled();
  });
});
