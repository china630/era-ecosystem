import {
  classifyExtraListBucket,
  dueDeskKeepsIssuedToday,
  extraListBucketMatches,
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

  it("splits awaiting, overdue, no-show, and issued cheques", () => {
    const today = new Date("2026-11-05T00:00:00+04:00");
    const past = new Date("2026-11-04T10:00:00+04:00");
    const future = new Date("2026-11-05T10:00:00+04:00");
    expect(
      classifyExtraListBucket({
        status: "PENDING_PAY",
        scheduledAt: future,
        issuedAt: null,
        todayStart: today,
      }),
    ).toBe("due");
    expect(
      classifyExtraListBucket({
        status: "PENDING_PAY",
        scheduledAt: past,
        issuedAt: null,
        todayStart: today,
      }),
    ).toBe("overdue");
    expect(
      classifyExtraListBucket({
        status: "NO_SHOW",
        scheduledAt: past,
        issuedAt: null,
        todayStart: today,
      }),
    ).toBe("noshow");
    expect(
      classifyExtraListBucket({
        status: "UNPAID_MISSED",
        scheduledAt: past,
        issuedAt: null,
        todayStart: today,
      }),
    ).toBe("noshow");
    expect(
      classifyExtraListBucket({
        status: "SCHEDULED",
        scheduledAt: past,
        issuedAt: past,
        todayStart: today,
      }),
    ).toBe("issued");
    expect(
      classifyExtraListBucket({
        status: "CANCELLED",
        scheduledAt: future,
        issuedAt: null,
        todayStart: today,
      }),
    ).toBeNull();
    expect(extraListBucketMatches("all", "issued")).toBe(true);
    expect(extraListBucketMatches("due", "overdue")).toBe(false);
    expect(
      dueDeskKeepsIssuedToday({ scheduledAt: future, todayStart: today, todayEnd: new Date("2026-11-06T00:00:00+04:00") }),
    ).toBe(true);
    expect(
      dueDeskKeepsIssuedToday({ scheduledAt: past, todayStart: today, todayEnd: new Date("2026-11-06T00:00:00+04:00") }),
    ).toBe(false);
  });

  it("dual-run flag comes from ClinicCutoverPolicy row, not CLINIC_ELEKTRAWEB_DUAL_RUN env", () => {
    process.env.CLINIC_ELEKTRAWEB_DUAL_RUN = "1";
    expect(dualRunEnabled({ elektrawebDualRun: false })).toBe(false);
    expect(dualRunEnabled({ elektrawebDualRun: true })).toBe(true);
    expect(dualRunEnabled(null)).toBe(false);
    delete process.env.CLINIC_ELEKTRAWEB_DUAL_RUN;
  });
});
