jest.mock("@/lib/dispatch-satellite-event", () => ({
  dispatchSatelliteEvent: jest.fn(async () => undefined),
}));

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-1",
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    projectParty: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    rfi: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    submittal: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    siteInspection: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    changeRequest: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    punchListItem: { create: jest.fn(), findFirst: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    drawingRevision: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    dailyLog: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

import { prisma } from "@/lib/prisma";
import { answerRfi, transitionSubmittal, failInspection, transitionChangeRequest } from "@/lib/project-depth.service";
import { createDrawingRevision } from "@/lib/cde-documents.service";
import { createPunchListItem, updatePunchListItemStatus } from "@/lib/punch-list.service";
import { submitDailyLog } from "@/lib/daily-logs.service";

describe("Construction Wave 3 depth negatives", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses invalid submittal transition", async () => {
    (prisma.submittal.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "s1",
      status: "DRAFT",
      projectId: "p1",
    });
    const result = await transitionSubmittal("p1", "s1", "APPROVED");
    expect(result).toMatchObject({ status: 409 });
  });

  it("refuses answer on already answered RFI", async () => {
    (prisma.rfi.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "r1",
      status: "ANSWERED",
      projectId: "p1",
      impactSchedule: false,
      impactCost: false,
    });
    const result = await answerRfi("p1", "r1", { answer: "done" });
    expect(result).toMatchObject({ status: 409 });
  });

  it("fail inspection creates punch", async () => {
    (prisma.siteInspection.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "i1",
      status: "DRAFT",
      title: "Fire stop",
      projectId: "p1",
    });
    (prisma.siteInspection.update as jest.Mock).mockResolvedValueOnce({
      id: "i1",
      status: "FAILED",
    });
    (prisma.punchListItem.create as jest.Mock).mockResolvedValueOnce({ id: "punch-1" });
    const result = await failInspection("p1", "i1");
    expect(result).toHaveProperty("punch");
    expect(prisma.punchListItem.create).toHaveBeenCalled();
  });

  it("refuses illegal change transition", async () => {
    (prisma.changeRequest.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "c1",
      status: "DRAFT",
      projectId: "p1",
    });
    const result = await transitionChangeRequest("p1", "c1", "APPROVED_OPS");
    expect(result).toMatchObject({ status: 409 });
  });

  it("refuses illegal punch transition VERIFIED→OPEN", async () => {
    (prisma.punchListItem.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "x1",
      status: "VERIFIED",
      projectId: "p1",
    });
    const result = await updatePunchListItemStatus("p1", "x1", "OPEN");
    expect(result).toMatchObject({ status: 409 });
  });

  it("refuses resubmit of daily log", async () => {
    (prisma.dailyLog.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "d1",
      status: "SUBMITTED",
      projectId: "p1",
    });
    const result = await submitDailyLog("p1", "d1");
    expect(result).toMatchObject({ status: 409 });
  });

  it("refuses punch pin to SUPERSEDED sheet", async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValueOnce({ id: "p1" });
    (prisma.drawingRevision.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "sheet-1",
      status: "SUPERSEDED",
      projectId: "p1",
    });
    const result = await createPunchListItem("p1", {
      location: "L1",
      description: "Crack",
      drawingRevisionId: "sheet-1",
      pinX: 0.5,
      pinY: 0.5,
    });
    expect(result).toMatchObject({ status: 400 });
    expect(prisma.punchListItem.create).not.toHaveBeenCalled();
  });

  it("publish drawing supersedes prior CURRENT", async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValueOnce({ id: "p1" });
    (prisma.$transaction as jest.Mock).mockImplementation(async (fn: (tx: typeof prisma) => unknown) =>
      fn(prisma),
    );
    (prisma.drawingRevision.updateMany as jest.Mock).mockResolvedValueOnce({ count: 1 });
    (prisma.drawingRevision.create as jest.Mock).mockResolvedValueOnce({
      id: "rev-new",
      status: "CURRENT",
    });
    const result = await createDrawingRevision({
      projectId: "p1",
      drawingCode: "A-101",
      revision: "B",
      publish: true,
    });
    expect(result).toHaveProperty("row");
    expect(prisma.drawingRevision.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ drawingCode: "A-101", status: "CURRENT" }),
        data: { status: "SUPERSEDED" },
      }),
    );
  });
});
