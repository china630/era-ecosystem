/**
 * AC-DH-MAT-CON negatives — missing material code.
 */
import { NotFoundException } from "@nestjs/common";
import { ConstructionMaterialsService } from "../src/registry/construction-materials/construction-materials.service";

describe("AC-DH-MAT-CON negatives", () => {
  it("getByCode throws MATERIAL_NOT_FOUND", async () => {
    const ds = {
      referenceDb: () => ({
        constructionMaterial: {
          findFirst: async () => null,
          findMany: async () => [],
        },
      }),
    };
    const svc = new ConstructionMaterialsService(ds as never);
    await expect(svc.getByCode("MISSING")).rejects.toBeInstanceOf(NotFoundException);
    try {
      await svc.getByCode("MISSING");
    } catch (e) {
      const body = (e as NotFoundException).getResponse() as {
        code?: string;
      };
      expect(body.code).toBe("MATERIAL_NOT_FOUND");
    }
  });
});
