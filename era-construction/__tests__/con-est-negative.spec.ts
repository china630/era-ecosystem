/**
 * AC-CON-EST negatives — estimate hierarchy transitions, empty approve, mode gate.
 */
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const mockPrisma = {
  project: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  estimatePackage: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  estimateDocument: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  estimateLine: {
    deleteMany: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
  },
  boqLine: {
    findMany: jest.fn(),
    upsert: jest.fn(),
  },
  progressAct: {
    findMany: jest.fn(),
  },
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mockPrisma)),
};

jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-1",
}));
jest.mock("@/lib/projects.service", () => ({
  findProjectById: jest.fn(async (id: string) => mockPrisma.project.findFirst({ where: { id } })),
}));

import {
  approveEstimatePackage,
  createEstimatePackage,
  setProjectEstimateMode,
  transitionEstimatePackage,
} from "@/lib/estimate.service";

describe("AC-CON-EST negatives", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses invalid estimateMode", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "p1",
      estimateMode: "FLAT_BOQ",
    });
    const result = await setProjectEstimateMode(
      "p1",
      "NOPE" as "FLAT_BOQ",
    );
    expect(result).toMatchObject({ status: 400 });
  });

  it("refuses create package when project is FLAT_BOQ", async () => {
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "p1",
      estimateMode: "FLAT_BOQ",
      financeContractId: null,
    });
    const result = await createEstimatePackage("p1", {});
    expect(result).toMatchObject({ status: 409 });
  });

  it("refuses illegal status transition", async () => {
    mockPrisma.estimatePackage.findFirst.mockResolvedValue({
      id: "pack-1",
      status: "DRAFT",
      deletedAt: null,
    });
    const result = await transitionEstimatePackage("pack-1", "APPROVED");
    expect(result).toMatchObject({ status: 409 });
  });

  it("refuses approve without EXTERNAL_REVIEW", async () => {
    mockPrisma.estimatePackage.findFirst.mockResolvedValue({
      id: "pack-1",
      projectId: "p1",
      status: "DRAFT",
      version: 1,
      deletedAt: null,
      documents: [],
    });
    const result = await approveEstimatePackage("pack-1");
    expect(result).toMatchObject({ status: 409 });
  });

  it("refuses approve with empty LCR/SC lines", async () => {
    mockPrisma.estimatePackage.findFirst.mockResolvedValue({
      id: "pack-1",
      projectId: "p1",
      organizationId: "org-1",
      status: "EXTERNAL_REVIEW",
      version: 1,
      deletedAt: null,
      financeContractId: null,
      documents: [
        {
          id: "d1",
          kind: "LCR",
          cipher: "ЛС-01-01-01",
          lines: [],
        },
      ],
    });
    const result = await approveEstimatePackage("pack-1");
    expect(result).toMatchObject({ status: 400 });
  });
});
