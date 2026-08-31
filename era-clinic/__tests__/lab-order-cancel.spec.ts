import { cancelLabOrder, LAB_NOT_ORDERED } from "@/domain/lab/lab-order-cancel.service";
import {
  assertLabOrderCanCreate,
  findEpisodeLabConflict,
  LAB_ALREADY_COMPLETED,
  LAB_ALREADY_OPEN,
} from "@/domain/lab/lab-order-conflict.service";

jest.mock("@/lib/prisma", () => ({
  prisma: {
    labOrder: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";

const labOrderMock = prisma.labOrder as unknown as {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  update: jest.Mock;
};

describe("lab-order-cancel.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("exports LAB_NOT_ORDERED code constant", () => {
    expect(LAB_NOT_ORDERED).toBe("LAB_NOT_ORDERED");
  });

  it("cancelLabOrder rejects non-ORDERED status", async () => {
    labOrderMock.findUnique.mockResolvedValue({ id: "o1", status: "COLLECTED" });
    await expect(cancelLabOrder("o1", { userId: "u1" })).rejects.toMatchObject({
      code: LAB_NOT_ORDERED,
    });
  });

  it("cancelLabOrder sets CANCELLED audit fields", async () => {
    labOrderMock.findUnique.mockResolvedValue({ id: "o1", status: "ORDERED" });
    labOrderMock.update.mockResolvedValue({ id: "o1", status: "CANCELLED" });
    await cancelLabOrder("o1", { userId: "u1", reason: "mistake" });
    expect(labOrderMock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "o1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelledByUserId: "u1",
          cancelReason: "mistake",
        }),
      }),
    );
  });
});

describe("lab-order-conflict.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("assertLabOrderCanCreate throws LAB_ALREADY_OPEN", () => {
    expect(() =>
      assertLabOrderCanCreate({ kind: "OPEN", orderId: "o1", testCode: "LAB-CBC" }),
    ).toThrow(expect.objectContaining({ code: LAB_ALREADY_OPEN }));
  });

  it("assertLabOrderCanCreate throws LAB_ALREADY_COMPLETED without confirmRepeat", () => {
    expect(() =>
      assertLabOrderCanCreate(
        { kind: "COMPLETED", orderId: "o1", testCode: "USG-ABD" },
        false,
      ),
    ).toThrow(expect.objectContaining({ code: LAB_ALREADY_COMPLETED }));
  });

  it("assertLabOrderCanCreate allows COMPLETED when confirmRepeat", () => {
    expect(() =>
      assertLabOrderCanCreate(
        { kind: "COMPLETED", orderId: "o1", testCode: "USG-ABD" },
        true,
      ),
    ).not.toThrow();
  });

  it("findEpisodeLabConflict detects open overlap", async () => {
    labOrderMock.findMany.mockResolvedValue([
      {
        id: "o-open",
        status: "ORDERED",
        testCode: "LAB-CBC",
        items: [{ serviceCode: "LAB-CBC" }],
      },
    ]);
    const hit = await findEpisodeLabConflict("ep1", ["LAB-CBC"]);
    expect(hit).toEqual({ kind: "OPEN", orderId: "o-open", testCode: "LAB-CBC" });
  });
});
