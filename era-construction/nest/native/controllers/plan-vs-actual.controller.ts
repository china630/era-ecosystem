import { Controller, Get, NotFoundException, Param, Req, UseGuards } from "@nestjs/common";
import type { BoqLine, ProgressAct } from "@prisma/client";
import { findProjectPlanVsActual } from "@/lib/projects.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

@Controller("api/projects/:id/plan-vs-actual")
@UseGuards(ConstructionStaffGuard)
export class PlanVsActualController {
  @Get()
  get(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const project = await findProjectPlanVsActual(id);
      if (!project) throw new NotFoundException({ error: "Project not found" });

      const requisitionByItem = new Map<string, number>();
      for (const mat of project.materialRequisitions) {
        const key = mat.itemCode;
        requisitionByItem.set(key, (requisitionByItem.get(key) ?? 0) + Number(mat.qty));
      }

      const approvedActs = project.progressActs.filter(
        (a: ProgressAct & { lines?: Array<{ itemCode: string; qty: unknown; amountNet: unknown }> }) =>
          a.status === "APPROVED",
      );

      const actualQtyByItem = new Map<string, number>();
      const actualAmountByItem = new Map<string, number>();
      for (const act of approvedActs) {
        const actLines =
          (act as { lines?: Array<{ itemCode: string; qty: unknown; amountNet: unknown }> }).lines ??
          [];
        for (const line of actLines) {
          const key = line.itemCode;
          actualQtyByItem.set(key, (actualQtyByItem.get(key) ?? 0) + Number(line.qty));
          actualAmountByItem.set(
            key,
            (actualAmountByItem.get(key) ?? 0) + Number(line.amountNet),
          );
        }
      }

      const approvedProgress = approvedActs.reduce(
        (sum: number, a: ProgressAct) => sum + Number(a.amountNet),
        0,
      );

      const lines = project.boqLines.map((boq: BoqLine) => {
        const requisitionQty = requisitionByItem.get(boq.itemCode) ?? 0;
        const plannedQty = Number(boq.plannedQty);
        const actualQty = actualQtyByItem.get(boq.itemCode) ?? 0;
        const actualAmountNet = actualAmountByItem.get(boq.itemCode) ?? 0;
        return {
          itemCode: boq.itemCode,
          description: boq.description,
          plannedQty,
          plannedAmountNet: Number(boq.plannedAmountNet),
          requisitionQty,
          actualQty,
          actualAmountNet,
          varianceQty: actualQty - plannedQty,
        };
      });

      const plannedAmountTotal = lines.reduce((s, l) => s + l.plannedAmountNet, 0);

      return {
        projectId: project.id,
        projectCode: project.code,
        projectName: project.name,
        lines,
        totals: {
          plannedAmountNet: plannedAmountTotal,
          progressApprovedNet: approvedProgress,
          varianceAmountNet: approvedProgress - plannedAmountTotal,
        },
      };
    });
  }
}
