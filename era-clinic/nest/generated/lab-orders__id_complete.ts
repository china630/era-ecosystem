import { SATELLITE_CLINIC_LAB_ORDER_COMPLETED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { createPaymentLink } from "@/integration/control-plane-platform.client";
import { findLabOrderWithPatientVisitItems, markLabOrderCompleted } from "@/domain/lab/lab-order-write.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

function testCodesFromOrder(testCode: string): string[] {
  return testCode.split(",").map((c) => c.trim()).filter(Boolean);
}

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/lab-orders/:id/complete", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
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

  
    if (!session) return sendJson(httpRes, { error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_COMPLETE);
    if (denied) return denied;

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return scopeDenied;
    const order = await findLabOrderWithPatientVisitItems(id);
    if (!order) return sendJson(httpRes, { error: "Lab order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) return sendJson(httpRes, { error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    if (order.status === "COMPLETED") return sendJson(httpRes, order);
    if (order.status !== "PUBLISHED") {
      return sendJson(httpRes, { error: 
        `Complete requires PUBLISHED status (current: ${order.status})` }, 400);
    }

    await assertRevenueEventForPublish({
      organizationId: requestOrganizationId(),
      fromSatelliteKey: "industry_clinic",
      eventType: SATELLITE_CLINIC_LAB_ORDER_COMPLETED,
    });

    const completed = await markLabOrderCompleted(id);

    const testCodes = order.items.length
      ? order.items.map((item: { serviceCode: string }) => item.serviceCode)
      : testCodesFromOrder(completed.testCode);

    await dispatchSatelliteEvent({
      type: SATELLITE_CLINIC_LAB_ORDER_COMPLETED,
      payload: {
        labOrderId: completed.id,
        orderId: completed.id,
        visitId: completed.visitId ?? undefined,
        patientRef: completed.patientRef.refCode,
        testCode: testCodes[0] ?? completed.testCode,
        testCodes,
        amountNet: Number(completed.amountNet),
        currency: "AZN",
      },
    });

    const organizationId = requestOrganizationId();
    const amountNet = Number(completed.amountNet);
    if (organizationId && amountNet > 0) {
      try {
        await createPaymentLink(
          {
            amountAzn: amountNet,
            sourceEntityType: "clinic_lab_order",
            sourceEntityId: completed.id,
            description: `Lab ${completed.testCode}`,
          },
          { organizationId },
        );
      } catch {
        // optional payment link
      }
    }

    return sendJson(httpRes, completed);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
