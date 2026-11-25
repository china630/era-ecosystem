import {
  BROUGHT_IN_BLANK_REASON,
  broughtInAgeDays,
  broughtInIsFresh,
  decideBroughtInClearReopen,
  ownBlankMaxDays,
  PACKAGE_BLOOD_BIOCHEM_CODES,
} from "@/domain/lab/brought-in-result";
import {
  cancelLabOrder,
  LAB_NOT_BROUGHT_IN_CANCEL,
  LAB_NOT_ORDERED,
  reopenBroughtInCancelledLabOrder,
} from "@/domain/lab/lab-order-cancel.service";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    labOrder: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("@/lib/satellite-audit", () => ({
  recordClinicAudit: jest.fn(),
}));

import { prisma } from "@/lib/prisma";

const labOrderMock = prisma.labOrder as unknown as {
  findUnique: jest.Mock;
  update: jest.Mock;
};

describe("brought-in blank helpers", () => {
  it("blocks own-blank on package blood biochem panels", () => {
    for (const code of PACKAGE_BLOOD_BIOCHEM_CODES) {
      expect(ownBlankMaxDays(code, 30)).toBeNull();
    }
    expect(ownBlankMaxDays("LAB-BIOCHEM-INFECT", 30)).toBe(30);
    expect(ownBlankMaxDays("LAB-BIOCHEM-INFECT", null)).toBeNull();
  });

  it("computes age and freshness in Baku calendar days", () => {
    expect(broughtInAgeDays("2026-11-01", "2026-11-20")).toBe(19);
    expect(broughtInIsFresh("2026-11-01", 30, "2026-11-20")).toBe(true);
    expect(broughtInIsFresh("2026-10-01", 30, "2026-11-20")).toBe(false);
    expect(broughtInIsFresh("2026-11-21", 30, "2026-11-20")).toBe(false);
  });

  it("reopens only when every matching order is a brought_in_blank cancel", () => {
    const t1 = new Date("2026-11-20T02:11:00.000Z");
    const t0 = new Date("2026-11-19T01:00:00.000Z");
    expect(
      decideBroughtInClearReopen([
        {
          id: "c1",
          status: "CANCELLED",
          cancelReason: BROUGHT_IN_BLANK_REASON,
          cancelledAt: t1,
        },
      ]),
    ).toEqual({ reopenOrderId: "c1" });

    expect(
      decideBroughtInClearReopen([
        {
          id: "c0",
          status: "CANCELLED",
          cancelReason: BROUGHT_IN_BLANK_REASON,
          cancelledAt: t0,
        },
        {
          id: "c1",
          status: "CANCELLED",
          cancelReason: BROUGHT_IN_BLANK_REASON,
          cancelledAt: t1,
        },
      ]),
    ).toEqual({ reopenOrderId: "c1" });

    expect(
      decideBroughtInClearReopen([
        {
          id: "c1",
          status: "CANCELLED",
          cancelReason: BROUGHT_IN_BLANK_REASON,
          cancelledAt: t1,
        },
        {
          id: "live",
          status: "ORDERED",
          cancelReason: null,
          cancelledAt: null,
        },
      ]),
    ).toEqual({ reopenOrderId: null });

    expect(
      decideBroughtInClearReopen([
        {
          id: "c1",
          status: "CANCELLED",
          cancelReason: BROUGHT_IN_BLANK_REASON,
          cancelledAt: t1,
        },
        {
          id: "done",
          status: "COMPLETED",
          cancelReason: null,
          cancelledAt: null,
        },
      ]),
    ).toEqual({ reopenOrderId: null });

    expect(decideBroughtInClearReopen([])).toEqual({ reopenOrderId: null });
  });
});

describe("reopenBroughtInCancelledLabOrder", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects non brought_in_blank cancellations", async () => {
    labOrderMock.findUnique.mockResolvedValue({
      id: "o1",
      status: "CANCELLED",
      cancelReason: "mistake",
      items: [],
    });
    await expect(reopenBroughtInCancelledLabOrder("o1")).rejects.toMatchObject({
      code: LAB_NOT_BROUGHT_IN_CANCEL,
    });
  });

  it("rejects non-CANCELLED orders", async () => {
    labOrderMock.findUnique.mockResolvedValue({
      id: "o1",
      status: "ORDERED",
      cancelReason: null,
      items: [],
    });
    await expect(reopenBroughtInCancelledLabOrder("o1")).rejects.toMatchObject({
      code: LAB_NOT_BROUGHT_IN_CANCEL,
    });
  });

  it("clears cancel fields back to ORDERED", async () => {
    labOrderMock.findUnique.mockResolvedValue({
      id: "o1",
      status: "CANCELLED",
      cancelReason: BROUGHT_IN_BLANK_REASON,
      clinicalEpisodeId: null,
      items: [],
    });
    labOrderMock.update.mockResolvedValue({
      id: "o1",
      status: "ORDERED",
      clinicalEpisodeId: null,
      items: [],
    });
    await reopenBroughtInCancelledLabOrder("o1");
    expect(labOrderMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "o1" },
        data: {
          status: "ORDERED",
          cancelledAt: null,
          cancelledByUserId: null,
          cancelReason: null,
        },
      }),
    );
  });

  it("still rejects non-ORDERED on cancelLabOrder", async () => {
    labOrderMock.findUnique.mockResolvedValue({ id: "o1", status: "CANCELLED" });
    await expect(cancelLabOrder("o1", { userId: "u1" })).rejects.toMatchObject({
      code: LAB_NOT_ORDERED,
    });
  });
});
