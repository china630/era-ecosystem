import {
  extraNeedsPaperTicket,
  extraTicketIdForOrder,
} from "@/domain/procedure/extra-ticket";

/** Pure mirror of ClinicCutoverPolicy.elektrawebDualRun (avoids Prisma/kit in this suite). */
function dualRunEnabled(policy: { elektrawebDualRun: boolean } | null | undefined): boolean {
  return !!policy?.elektrawebDualRun;
}

describe("extra procedure ticket (Nafta dual-run)", () => {
  it("builds a stable clinic ticket id", () => {
    expect(extraTicketIdForOrder("abc")).toBe("clinic-ticket-abc");
  });

  it("requires a paper ticket only when the extra has a charge", () => {
    expect(extraNeedsPaperTicket({ amountNet: 17 })).toBe(true);
    expect(extraNeedsPaperTicket({ amountNet: 0 })).toBe(false);
    expect(extraNeedsPaperTicket({ amountNet: 0, packageIncluded: true })).toBe(false);
  });

  it("still tickets over-quota package extras", () => {
    expect(extraNeedsPaperTicket({ amountNet: 25, packageIncluded: true })).toBe(true);
  });

  it("dual-run flag comes from ClinicCutoverPolicy row, not CLINIC_ELEKTRAWEB_DUAL_RUN env", () => {
    process.env.CLINIC_ELEKTRAWEB_DUAL_RUN = "1";
    expect(dualRunEnabled({ elektrawebDualRun: false })).toBe(false);
    expect(dualRunEnabled({ elektrawebDualRun: true })).toBe(true);
    expect(dualRunEnabled(null)).toBe(false);
    delete process.env.CLINIC_ELEKTRAWEB_DUAL_RUN;
  });
});
