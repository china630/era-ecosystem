import type { BoqLine, ProgressAct } from "@prisma/client";
import { findProjectPlanVsActual } from "@/lib/projects.service";
import { enterConstructionStaff, constructionNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithConstructionTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/projects/:id/plan-vs-actual", async (httpReq, httpRes) => {
    if (!(await enterConstructionStaff(httpReq, httpRes))) return;
    try {
      const session = await constructionNestSession(httpReq);
      const web = await runWithConstructionTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const { id } = httpReq.params;
    const project = await findProjectPlanVsActual(id);
    if (!project) return sendJson(httpRes, { error: "Project not found" }, 404);

    const requisitionByItem = new Map<string, number>();
    for (const req of project.materialRequisitions) {
      const key = req.itemCode;
      requisitionByItem.set(
        key,
        (requisitionByItem.get(key) ?? 0) + Number(req.qty),
      );
    }

    const approvedProgress = project.progressActs
      .filter((a: ProgressAct) => a.status === "APPROVED")
      .reduce((sum: number, a: ProgressAct) => sum + Number(a.amountNet), 0);

    const lines = project.boqLines.map((boq: BoqLine) => {
      const requisitionQty = requisitionByItem.get(boq.itemCode) ?? 0;
      const plannedQty = Number(boq.plannedQty);
      return {
        itemCode: boq.itemCode,
        description: boq.description,
        plannedQty,
        plannedAmountNet: Number(boq.plannedAmountNet),
        requisitionQty,
        varianceQty: requisitionQty - plannedQty,
      };
    });

    const plannedAmountTotal = lines.reduce(
      (s: number, l: (typeof lines)[number]) => s + l.plannedAmountNet,
      0,
    );

    return sendJson(httpRes, {
      projectId: project.id,
      projectCode: project.code,
      projectName: project.name,
      lines,
      totals: {
        plannedAmountNet: plannedAmountTotal,
        progressApprovedNet: approvedProgress,
        varianceAmountNet: approvedProgress - plannedAmountTotal,
      },
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
