import {
  createSelectionItem,
  createWarrantyCase,
  transitionSelectionPackage,
  transitionWarrantyCase,
} from "@/lib/selections-warranty.service";
import {
  crmNestSession,
  enterCrmStaff,
  runWithCrmTenant,
  sendJson,
  sendRouteError,
} from "../bridge";

export function register(http: {
  get: Function;
  post: Function;
  put: Function;
  patch: Function;
  delete: Function;
}) {
  http.post("/api/selection-packages/:id/items", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      await runWithCrmTenant(session, async () => {
        const body = (httpReq.body ?? {}) as {
          code?: string;
          label?: string;
          amount?: number;
          status?: string;
        };
        if (!body.code?.trim() || !body.label?.trim()) {
          return sendJson(httpRes, { error: "code and label required" }, 400);
        }
        const result = await createSelectionItem(httpReq.params.id, {
          code: body.code,
          label: body.label,
          amount: body.amount,
          status: body.status,
        });
        if ("error" in result) return sendJson(httpRes, { error: result.error }, result.status);
        return sendJson(httpRes, result.row, 201);
      });
    } catch (e) {
      return sendJson(httpRes, { error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  http.patch("/api/selection-packages/:id", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      await runWithCrmTenant(session, async () => {
        const status = String((httpReq.body ?? {}).status ?? "");
        if (!["OPEN", "APPROVED", "CLOSED"].includes(status)) {
          return sendJson(httpRes, { error: "invalid status" }, 400);
        }
        const result = await transitionSelectionPackage(
          httpReq.params.id,
          status as "OPEN" | "APPROVED" | "CLOSED",
        );
        if ("error" in result) return sendJson(httpRes, { error: result.error }, result.status);
        return sendJson(httpRes, result.row);
      });
    } catch (e) {
      return sendJson(httpRes, { error: e instanceof Error ? e.message : "error" }, 500);
    }
  });

  http.post("/api/leads/:id/warranty-cases", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      await runWithCrmTenant(session, async () => {
        const { assertLeadInScope } = await import("@/lib/integrations/lead-scope");
        if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
        await assertLeadInScope({
          organizationId: session.organizationId,
          userId: session.sub,
          leadId: String(httpReq.params.id),
          permissions: session.permissions ?? [],
          isOwner: session.isOwner === true,
        });
        const body = (httpReq.body ?? {}) as {
          subject?: string;
          partyRef?: string;
          constructionProjectId?: string;
          notes?: string;
        };
        if (!body.subject?.trim()) {
          return sendJson(httpRes, { error: "subject required" }, 400);
        }
        const result = await createWarrantyCase(httpReq.params.id, {
          subject: body.subject,
          partyRef: body.partyRef,
          constructionProjectId: body.constructionProjectId,
          notes: body.notes,
        });
        if ("error" in result) return sendJson(httpRes, { error: result.error }, result.status);
        return sendJson(httpRes, result.row, 201);
      });
    } catch (e) {
      await sendRouteError(httpRes, e);
    }
  });

  http.patch("/api/warranty-cases/:id", async (httpReq, httpRes) => {
    if (!(await enterCrmStaff(httpReq, httpRes))) return;
    try {
      const session = await crmNestSession(httpReq);
      await runWithCrmTenant(session, async () => {
        const status = String((httpReq.body ?? {}).status ?? "");
        if (!["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].includes(status)) {
          return sendJson(httpRes, { error: "invalid status" }, 400);
        }
        const result = await transitionWarrantyCase(
          httpReq.params.id,
          status as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED",
        );
        if ("error" in result) return sendJson(httpRes, { error: result.error }, result.status);
        return sendJson(httpRes, result.row);
      });
    } catch (e) {
      return sendJson(httpRes, { error: e instanceof Error ? e.message : "error" }, 500);
    }
  });
}
