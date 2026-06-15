import {
  listPractitioners,
  createPractitioner,
  deletePractitioner,
} from "@/domain/master-data/master-data.service";

jest.mock("@/lib/satellite-audit", () => ({
  recordClinicAudit: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    practitioner: {
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

describe("clinic-master-data.service", () => {
  it("lists practitioners ordered by code", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.practitioner.findMany.mockResolvedValue([{ id: "1", code: "DR1", fullName: "Dr One" }]);
    const rows = await listPractitioners();
    expect(rows).toHaveLength(1);
    expect(prisma.practitioner.findMany).toHaveBeenCalled();
  });

  it("creates practitioner", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.practitioner.create.mockResolvedValue({ id: "2", code: "DR2", fullName: "Dr Two" });
    const row = await createPractitioner({ code: "DR2", fullName: "Dr Two" });
    expect(row.code).toBe("DR2");
  });

  it("deletes practitioner", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.practitioner.delete.mockResolvedValue({});
    await deletePractitioner("x");
    expect(prisma.practitioner.delete).toHaveBeenCalledWith({ where: { id: "x" } });
  });
});
