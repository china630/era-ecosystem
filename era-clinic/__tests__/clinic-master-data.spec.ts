import {
  listPractitioners,
  updatePractitionerOpsCatalog,
  deletePractitioner,
} from "@/domain/master-data/master-data.service";

jest.mock("@/lib/satellite-audit", () => ({
  recordClinicAudit: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    practitioner: {
      findMany: jest.fn(),
      update: jest.fn(),
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

  it("updates ops catalog fields only", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.practitioner.update.mockResolvedValue({
      id: "2",
      code: "DR2",
      specialty: "Therapist",
      defaultSlotMinutes: 30,
    });
    const row = await updatePractitionerOpsCatalog("2", {
      specialty: "Therapist",
      defaultSlotMinutes: 30,
    });
    expect(row.specialty).toBe("Therapist");
  });

  it("deletes practitioner", async () => {
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.practitioner.delete.mockResolvedValue({});
    await deletePractitioner("x");
    expect(prisma.practitioner.delete).toHaveBeenCalledWith({ where: { id: "x" } });
  });
});
