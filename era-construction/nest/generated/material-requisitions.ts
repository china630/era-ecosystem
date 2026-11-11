import { requestOrganizationId } from "@/lib/request-organization";
import { z } from "zod";
import { createShipment } from "@/integration/control-plane-platform.client";
import { materialRequisitionDenied } from "@/lib/material-gates";
import { findProjectByCode } from "@/lib/projects.service";
import { createMaterialRequisition, listMaterialRequisitions } from "@/lib/material-requisitions.service";
import { enterConstructionStaff, constructionNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithConstructionTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const createSchema = z.object({
  projectCode: z.string(),
  itemCode: z.string(),
  description: z.string(),
  qty: z.number().positive(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/material-requisitions", async (httpReq, httpRes) => {
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
    const requisitions = await listMaterialRequisitions();
    return sendJson(httpRes, requisitions);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/material-requisitions", async (httpReq, httpRes) => {
    if (!(await enterConstructionStaff(httpReq, httpRes))) return;
    try {
      const session = await constructionNestSession(httpReq);
      const web = await runWithConstructionTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    if (!(session)) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const body = createSchema.parse(httpReq.body);
    const project = await findProjectByCode(body.projectCode);
    const denied = materialRequisitionDenied(project);
    if (denied) return sendJson(httpRes, { error: denied }, 404);
    if (!project) return sendJson(httpRes, { error: "Project not found" }, 404);

    const requisition = await createMaterialRequisition({
      projectId: project.id,
      itemCode: body.itemCode,
      description: body.description,
      qty: body.qty,
    });

    const organizationId = requestOrganizationId();
    if (organizationId) {
      try {
        await createShipment(
          {
            sourceEntityType: "material_requisition",
            sourceEntityId: requisition.id,
            externalRef: body.itemCode,
          },
          { organizationId },
        );
      } catch {
        // optional delivery stub
      }
    }

    return sendJson(httpRes, requisition, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
