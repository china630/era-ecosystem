/**
 * Estimate CSV import parse + approve eventHint includes lines for Finance SOV seed.
 */
import { describe, expect, it, jest, beforeEach } from "@jest/globals";

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
  $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
    fn(mockPrisma),
  ),
};

jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-1",
}));
jest.mock("@/lib/projects.service", () => ({
  findProjectById: jest.fn(async (id: string) =>
    mockPrisma.project.findFirst({ where: { id } }),
  ),
}));

import {
  approveEstimatePackage,
  parseEstimateLinesCsv,
} from "@/lib/estimate.service";

describe("parseEstimateLinesCsv", () => {
  it("parses header + rows", () => {
    const rows = parseEstimateLinesCsv(
      "itemCode,description,qty,unitRate\nA-1,Wall,2,10\nB-2,Floor,1,5\n",
    );
    expect(rows).toEqual([
      { itemCode: "A-1", description: "Wall", qty: 2, unitRate: 10 },
      { itemCode: "B-2", description: "Floor", qty: 1, unitRate: 5 },
    ]);
  });

  it("parses without header", () => {
    const rows = parseEstimateLinesCsv("X-9,Beam,3,100");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      itemCode: "X-9",
      description: "Beam",
      qty: 3,
      unitRate: 100,
    });
  });

  it("returns empty for blank csv", () => {
    expect(parseEstimateLinesCsv("  ")).toEqual([]);
  });
});

describe("approveEstimatePackage eventHint lines", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("includes leaf lines in eventHint for Finance SOV seed", async () => {
    mockPrisma.estimatePackage.findFirst.mockResolvedValue({
      id: "pack-1",
      projectId: "p1",
      organizationId: "org-1",
      version: 2,
      status: "EXTERNAL_REVIEW",
      financeContractId: "fin-c-1",
      documents: [
        {
          id: "doc-1",
          kind: "LCR",
          lines: [
            {
              id: "el-1",
              itemCode: "L-01",
              description: "Concrete",
              qty: 10,
              amountNet: 500,
            },
          ],
        },
      ],
    });
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "p1",
      financeContractId: "fin-c-1",
    });
    mockPrisma.estimatePackage.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.estimatePackage.update.mockResolvedValue({
      id: "pack-1",
      status: "APPROVED",
    });
    mockPrisma.boqLine.upsert.mockResolvedValue({ id: "boq-1" });
    mockPrisma.estimateLine.update.mockResolvedValue({});

    const result = await approveEstimatePackage("pack-1");
    expect(result).toMatchObject({
      sovSeedEligible: true,
      financeContractId: "fin-c-1",
      eventHint: {
        type: "SATELLITE_CONSTRUCTION_ESTIMATE_PACKAGE_APPROVED",
        packageId: "pack-1",
        financeContractId: "fin-c-1",
        lineCount: 1,
        amountNet: 500,
        lines: [
          {
            itemCode: "L-01",
            description: "Concrete",
            qty: 10,
            amountNet: 500,
          },
        ],
      },
    });
  });

  it("falls back to project financeContractId when pack has none", async () => {
    mockPrisma.estimatePackage.findFirst.mockResolvedValue({
      id: "pack-2",
      projectId: "p1",
      organizationId: "org-1",
      version: 1,
      status: "EXTERNAL_REVIEW",
      financeContractId: null,
      documents: [
        {
          id: "doc-1",
          kind: "LCR",
          lines: [
            {
              id: "el-1",
              itemCode: "L-02",
              description: "Steel",
              qty: 1,
              amountNet: 50,
            },
          ],
        },
      ],
    });
    mockPrisma.project.findFirst.mockResolvedValue({
      id: "p1",
      financeContractId: "fin-from-project",
    });
    mockPrisma.estimatePackage.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.estimatePackage.update.mockResolvedValue({
      id: "pack-2",
      status: "APPROVED",
    });
    mockPrisma.boqLine.upsert.mockResolvedValue({ id: "boq-2" });
    mockPrisma.estimateLine.update.mockResolvedValue({});

    const result = await approveEstimatePackage("pack-2");
    expect(result).toMatchObject({
      eventHint: { financeContractId: "fin-from-project" },
    });
  });
});
