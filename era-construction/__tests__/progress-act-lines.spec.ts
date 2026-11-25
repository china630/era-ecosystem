jest.mock("@/lib/prisma", () => ({
  prisma: {
    progressAct: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    progressActLine: {
      findMany: jest.fn(),
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    boqLine: {
      findFirst: jest.fn(),
    },
    project: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import {
  approveProgressAct,
  createDraftProgressAct,
  patchProgressActFinancePayApp,
  replaceProgressActLines,
} from "@/lib/progress-acts.service";

describe("progress act lines (M13 ops SOV)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses replace on APPROVED act", async () => {
    (prisma.progressAct.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      status: "APPROVED",
      projectId: "p1",
      organizationId: "org-1",
    });
    const result = await replaceProgressActLines("act-1", [
      { itemCode: "A", description: "Work", qty: 1, amountNet: 100 },
    ]);
    expect(result).toMatchObject({ status: 409 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses empty lines replace with 400", async () => {
    (prisma.progressAct.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      status: "DRAFT",
      projectId: "p1",
      organizationId: "org-1",
    });
    const result = await replaceProgressActLines("act-1", []);
    expect(result).toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses boqLineId not on project", async () => {
    (prisma.progressAct.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      status: "DRAFT",
      projectId: "p1",
      organizationId: "org-1",
    });
    (prisma.boqLine.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const result = await replaceProgressActLines("act-1", [
      {
        itemCode: "A",
        description: "Work",
        qty: 1,
        amountNet: 100,
        boqLineId: "missing-boq",
      },
    ]);
    expect(result).toMatchObject({ status: 400 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("sums line amountNet onto the act header inside a transaction", async () => {
    (prisma.progressAct.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      status: "DRAFT",
      projectId: "p1",
      organizationId: "org-1",
    });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    (prisma.progressActLine.deleteMany as jest.Mock).mockResolvedValueOnce({ count: 0 });
    (prisma.progressActLine.createMany as jest.Mock).mockResolvedValueOnce({ count: 2 });
    (prisma.progressAct.update as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      amountNet: 150,
      lines: [],
      project: { id: "p1" },
    });

    const result = await replaceProgressActLines("act-1", [
      { itemCode: "A", description: "One", qty: 1, amountNet: 100 },
      { itemCode: "B", description: "Two", qty: 2, amountNet: 50 },
    ]);

    expect(result).toHaveProperty("act");
    expect(prisma.progressAct.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { amountNet: 150 },
      }),
    );
  });

  it("create draft act refuses missing project", async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const result = await createDraftProgressAct("missing");
    expect(result).toMatchObject({ status: 404 });
  });

  it("approve is idempotent for APPROVED acts", async () => {
    (prisma.progressAct.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      status: "APPROVED",
      projectId: "p1",
      amountNet: 100,
      lines: [],
      project: { id: "p1", code: "P1" },
    });
    const result = await approveProgressAct("act-1");
    expect(result).toMatchObject({ idempotent: true });
    expect(prisma.progressAct.update).not.toHaveBeenCalled();
  });

  it("refuses approve when amountNet is zero", async () => {
    (prisma.progressAct.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      status: "DRAFT",
      projectId: "p1",
      amountNet: 0,
      lines: [],
      project: { id: "p1", code: "P1" },
    });
    const result = await approveProgressAct("act-1");
    expect(result).toMatchObject({ status: 400 });
    expect(prisma.progressAct.update).not.toHaveBeenCalled();
  });
});

describe("patchProgressActFinancePayApp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses PayApp ref on DRAFT act", async () => {
    (prisma.progressAct.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      status: "DRAFT",
      projectId: "p1",
    });
    const result = await patchProgressActFinancePayApp("act-1", "pay-1");
    expect(result).toMatchObject({ status: 400 });
    expect(prisma.progressAct.update).not.toHaveBeenCalled();
  });

  it("saves PayApp ref on APPROVED act", async () => {
    (prisma.progressAct.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      status: "APPROVED",
      projectId: "p1",
    });
    (prisma.progressAct.update as jest.Mock).mockResolvedValueOnce({
      id: "act-1",
      status: "APPROVED",
      financePayAppId: "pay-1",
      lines: [],
      project: { id: "p1" },
    });
    const result = await patchProgressActFinancePayApp("act-1", "pay-1");
    expect(result).toMatchObject({
      act: { financePayAppId: "pay-1" },
    });
  });
});

describe("createDraftProgressAct financeContractId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("stamps project financeContractId onto new draft act", async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "p1",
      financeContractId: "fin-c-9",
    });
    (prisma.progressAct.create as jest.Mock).mockResolvedValueOnce({
      id: "act-new",
      status: "DRAFT",
      financeContractId: "fin-c-9",
      lines: [],
      project: { id: "p1" },
    });
    const result = await createDraftProgressAct("p1", {});
    expect(prisma.progressAct.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ financeContractId: "fin-c-9" }),
      }),
    );
    expect(result).toMatchObject({ act: { id: "act-new" } });
  });
});
