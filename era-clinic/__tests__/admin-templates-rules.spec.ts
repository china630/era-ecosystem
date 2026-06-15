jest.mock("@/lib/prisma", () => ({
  prisma: {
    procedureRule: {
      update: jest.fn(),
    },
    procedureCompatibilityRule: {
      update: jest.fn(),
    },
    clinicalTemplate: {
      update: jest.fn(),
    },
  },
}));

describe("admin rules and templates PATCH services", () => {
  it("updates procedure rule kind and gap", async () => {
    const { updateProcedureRule } = await import("@/lib/procedure-rules.service");
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.procedureRule.update.mockResolvedValue({ id: "r1", minGapMinutes: 60 });

    const row = await updateProcedureRule("r1", { minGapMinutes: 60, kind: "SEQUENCE_GAP" });
    expect(row.minGapMinutes).toBe(60);
    expect(prisma.procedureRule.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { minGapMinutes: 60, kind: "SEQUENCE_GAP" },
    });
  });

  it("updates compatibility rule fields", async () => {
    const { updateCompatibilityRule } = await import("@/lib/procedure-compatibility.service");
    const { prisma } = jest.requireMock("@/lib/prisma");
    prisma.procedureCompatibilityRule.update.mockResolvedValue({
      id: "c1",
      ruleType: "MIN_HOURS_GAP",
      minHours: 12,
    });

    const row = await updateCompatibilityRule("c1", {
      ruleType: "MIN_HOURS_GAP",
      minHours: 12,
      note: "test",
    });
    expect(row.minHours).toBe(12);
  });
});
