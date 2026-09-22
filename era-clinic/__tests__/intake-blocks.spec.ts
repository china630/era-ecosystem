import { INTAKE_BLOCKS, ensureIntakeBlocksOnTemplate } from "@/domain/sanatorium/intake-blocks";

describe("intake blocks defaults", () => {
  it("defines four AUTO_ON_OPEN intake SKUs", () => {
    expect(INTAKE_BLOCKS.map((b) => b.procedureCode)).toEqual([
      "VISIT-SANATORIUM-INTAKE",
      "GYN-OR-URO",
      "CARDIO-ECG",
      "USG-ABD",
    ]);
  });

  it("ensureIntakeBlocksOnTemplate creates missing rows", async () => {
    const created: string[] = [];
    const tx = {
      programTemplateProcedure: {
        findFirst: async () => null,
        create: async ({ data }: { data: { procedureCode: string } }) => {
          created.push(data.procedureCode);
        },
        update: async () => undefined,
      },
      programTemplateQuotaKnot: {
        findFirst: async () => null,
        create: async () => undefined,
      },
    };
    const report = await ensureIntakeBlocksOnTemplate(tx as never, "tpl-1", [7, 10]);
    expect(report.created).toEqual(created);
    expect(report.created).toHaveLength(4);
    expect(report.knots).toBe(8);
  });
});
