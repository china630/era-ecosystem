jest.mock("@/lib/dispatch-satellite-event", () => ({
  dispatchSatelliteEvent: jest.fn(async () => undefined),
}));

jest.mock("@/lib/request-organization", () => ({
  requestOrganizationId: () => "org-1",
}));

jest.mock("@/lib/prisma", () => ({
  prisma: {
    project: { findFirst: jest.fn() },
    subcontractorClaim: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    materialRequisition: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    projectTask: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    equipmentLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    projectPhase: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  createSubcontractorClaim,
  transitionSubcontractorClaim,
} from "@/lib/subcontractor-claims.service";
import { transitionMaterialRequisition } from "@/lib/material-requisitions.service";
import { createProjectTask } from "@/lib/gantt.service";
import { createEquipmentLog } from "@/lib/equipment-hours.service";
import { softDeletePhase } from "@/lib/project-depth.service";

describe("Construction Wave 4 product negatives", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("refuses claim amount <= 0", async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValueOnce({ id: "p1" });
    const result = await createSubcontractorClaim("p1", {
      subcontractorName: "Sub",
      amountNet: 0,
    });
    expect(result).toMatchObject({ status: 400 });
    expect(prisma.subcontractorClaim.create).not.toHaveBeenCalled();
  });

  it("refuses illegal claim transition", async () => {
    (prisma.subcontractorClaim.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "c1",
      status: "APPROVED_OPS",
      projectId: "p1",
    });
    const result = await transitionSubcontractorClaim("p1", "c1", "SUBMITTED");
    expect(result).toMatchObject({ status: 409 });
  });

  it("refuses illegal requisition transition", async () => {
    (prisma.materialRequisition.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "r1",
      status: "CANCELLED",
    });
    const result = await transitionMaterialRequisition("r1", "SUBMITTED");
    expect(result).toMatchObject({ status: 409 });
  });

  it("refuses gantt end before start", async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValueOnce({ id: "p1" });
    const result = await createProjectTask("p1", {
      name: "Excavate",
      startDate: new Date("2026-11-10"),
      endDate: new Date("2026-11-01"),
    });
    expect(result).toMatchObject({ status: 400 });
    expect(prisma.projectTask.create).not.toHaveBeenCalled();
  });

  it("refuses equipment for missing project", async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValueOnce(null);
    const result = await createEquipmentLog({
      projectId: "missing",
      equipmentCode: "EX-1",
      hours: 4,
      logDate: new Date("2026-11-18"),
    });
    expect(result).toMatchObject({ status: 404 });
  });

  it("soft-deletes phase", async () => {
    (prisma.projectPhase.findFirst as jest.Mock).mockResolvedValueOnce({
      id: "ph1",
      projectId: "p1",
    });
    (prisma.projectPhase.update as jest.Mock).mockResolvedValueOnce({
      id: "ph1",
      deletedAt: new Date(),
    });
    const result = await softDeletePhase("p1", "ph1");
    expect(result).toHaveProperty("row");
    expect(prisma.projectPhase.update).toHaveBeenCalled();
  });
});
