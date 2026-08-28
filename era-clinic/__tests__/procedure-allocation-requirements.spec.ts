jest.mock("@/lib/prisma", () => ({
  prisma: {
    resource: {
      findFirst: jest.fn(),
    },
  },
}));

import { listPhysicalRequirementResources } from "@/domain/procedure/procedure-allocation.service";

describe("listPhysicalRequirementResources", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns all declared LOCATION cabinets for multi-cabinet procedures", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.resource.findFirst.mockImplementation(async ({ where }: { where: { code?: string } }) => {
      const map: Record<string, { id: string; code: string; capacity: number }> = {
        "WO-ROOM-7": { id: "r7", code: "WO-ROOM-7", capacity: 1 },
        "WO-ROOM-8": { id: "r8", code: "WO-ROOM-8", capacity: 1 },
        "WO-ROOM-13": { id: "r13", code: "WO-ROOM-13", capacity: 1 },
      };
      return map[where.code ?? ""] ?? null;
    });

    const rows = await listPhysicalRequirementResources({
      resourceKind: "ROOM",
      requirements: [
        { role: "LOCATION", resourceCode: "WO-ROOM-7", resourceKind: "ROOM" },
        { role: "LOCATION", resourceCode: "WO-ROOM-8", resourceKind: "ROOM" },
        { role: "LOCATION", resourceCode: "WO-ROOM-13", resourceKind: "ROOM" },
        { role: "STAFF", resourceCode: null, resourceKind: null },
      ],
    });

    expect(rows.map((r) => r.code)).toEqual(["WO-ROOM-13", "WO-ROOM-7", "WO-ROOM-8"]);
  });

  it("skips retired cabinets removed from DB but keeps remaining requirement codes", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.resource.findFirst.mockImplementation(async ({ where }: { where: { code?: string } }) => {
      if (where.code === "WO-ROOM-14") return null;
      if (where.code === "WO-ROOM-7") {
        return { id: "r7", code: "WO-ROOM-7", capacity: 1 };
      }
      return null;
    });

    const rows = await listPhysicalRequirementResources({
      resourceKind: "ROOM",
      requirements: [
        { role: "LOCATION", resourceCode: "WO-ROOM-14", resourceKind: "ROOM" },
        { role: "LOCATION", resourceCode: "WO-ROOM-7", resourceKind: "ROOM" },
      ],
    });

    expect(rows.map((r) => r.code)).toEqual(["WO-ROOM-7"]);
    expect(prisma.resource.findFirst).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { kind: "ROOM" } }),
    );
  });

  it("does not fall back to arbitrary room when explicit codes are missing in DB", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.resource.findFirst.mockResolvedValue(null);

    const rows = await listPhysicalRequirementResources({
      resourceKind: "ROOM",
      resourceCode: "WO-ROOM-14",
      requirements: [{ role: "LOCATION", resourceCode: "WO-ROOM-14", resourceKind: "ROOM" }],
    });

    expect(rows).toEqual([]);
  });
});
