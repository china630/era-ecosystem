import { canAssignBed } from "@era/clinic-domain";

jest.mock("@/lib/satellite-audit", () => ({
  recordClinicAudit: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    ward: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    bed: {
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    bedAssignment: {
      findFirst: jest.fn(),
    },
    inpatientAdmission: {
      create: jest.fn(),
    },
    $transaction: jest.fn((fn: (tx: unknown) => unknown) =>
      fn({
        inpatientAdmission: { create: jest.fn().mockResolvedValue({ id: "adm1" }) },
        bedAssignment: { create: jest.fn().mockResolvedValue({ id: "ba1" }) },
        bed: { update: jest.fn() },
      }),
    ),
  },
}));

describe("ward.service", () => {
  it("lists wards", async () => {
    const { listWards } = await import("@/domain/inpatient/ward.service");
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.ward.findMany.mockResolvedValue([{ id: "w1", code: "W1" }]);
    const rows = await listWards();
    expect(rows).toHaveLength(1);
  });

  it("uses domain bed guard", () => {
    expect(canAssignBed("AVAILABLE", false)).toBe(true);
    expect(canAssignBed("OCCUPIED", false)).toBe(false);
  });

  it("updates ward via service", async () => {
    const { updateWard } = await import("@/domain/inpatient/ward.service");
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.ward.update.mockResolvedValue({ id: "w1", name: "Updated" });
    const row = await updateWard("w1", { name: "Updated" });
    expect(row.name).toBe("Updated");
  });
});
