import { isMissingProcedureOrder } from "@/domain/procedure/procedure-order-if-present";

describe("isMissingProcedureOrder", () => {
  it("recognises Prisma P2025 and the update-not-found text", () => {
    expect(isMissingProcedureOrder({ code: "P2025" })).toBe(true);
    expect(
      isMissingProcedureOrder(
        new Error("Invalid `prisma.procedureOrder.update()` invocation:\nNo record was found for an update."),
      ),
    ).toBe(true);
    expect(isMissingProcedureOrder(new Error("cabin busy"))).toBe(false);
  });
});
