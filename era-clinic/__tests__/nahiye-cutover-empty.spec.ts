jest.mock("@/lib/prisma", () => ({
  prisma: {},
}));

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org1",
}));

import { applyNahiyeToProcedureOrder } from "@/domain/physio/nahiye-cutover.service";

describe("applyNahiyeToProcedureOrder empty catalog", () => {
  it("does not throw when physio_site is empty — drops chips, keeps residue path", async () => {
    const tx = {
      physioSite: { findMany: jest.fn().mockResolvedValue([]) },
      physioListItem: { findMany: jest.fn().mockResolvedValue([]) },
      procedureType: { findFirst: jest.fn().mockResolvedValue({ needsSite: true }) },
      procedureOrderSite: { deleteMany: jest.fn().mockResolvedValue({ count: 0 }), createMany: jest.fn() },
      procedureOrder: { update: jest.fn().mockResolvedValue({}) },
      physioNahiyeQueue: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn(),
      },
    };

    await expect(
      applyNahiyeToProcedureOrder(tx as never, "order-1", {
        nahiye: "Belinə",
        procedureName: "Solyuks",
        replaceSites: true,
      }),
    ).resolves.toBeUndefined();

    expect(tx.procedureOrderSite.createMany).not.toHaveBeenCalled();
    expect(tx.procedureOrder.update).toHaveBeenCalled();
    const updateArg = tx.procedureOrder.update.mock.calls[0][0];
    // Empty DB drops chips — keep WO nahiye for re-Apply after seed.
    expect(updateArg.data.note).toBe("Belinə");
  });
});
