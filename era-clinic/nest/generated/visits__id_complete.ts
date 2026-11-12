import { SATELLITE_CLINIC_VISIT_COMPLETED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { completeVisitBilling, resolveBillingTarget } from "@/lib/billing-router";
import { createPortalLink, createPaymentLink } from "@/integration/control-plane-platform.client";
import { completeLinkedAppointment, completeVisitRecord, getVisitForCompletion } from "@/domain/visit/visit.service";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";



export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.post("/api/visits/:id/complete", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return denied;

    const { id } = httpReq.params;
    const visit = await getVisitForCompletion(id);
    if (!visit) return sendJson(httpRes, { error: "Visit not found" }, 404);
    if (visit.status === "COMPLETED") return sendJson(httpRes, visit);
    const { visitAwaitingPaymentDenied } = await import("@/domain/visit/visit-pay-gate");
    const unpaid = visitAwaitingPaymentDenied(visit);
    if (unpaid) return sendJson(httpRes, { error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);

    // Mirror completeVisitBilling target — assert REVENUE before COMPLETED when Finance path.
    const billingTarget =
      visit.billingTarget === "HOTEL_FOLIO"
        ? "HOTEL_FOLIO"
        : visit.billingTarget === "SETTLEMENT_HUB"
          ? "SETTLEMENT_HUB"
          : await resolveBillingTarget(visit.patientOrigin);
    if (billingTarget === "FINANCE") {
      await assertRevenueEventForPublish({
        organizationId: requestOrganizationId(),
        fromSatelliteKey: "industry_clinic",
        eventType: SATELLITE_CLINIC_VISIT_COMPLETED,
      });
    }

    const completed = await completeVisitRecord(id);

    if (completed.appointment) {
      await completeLinkedAppointment(completed.appointment.id);
    }

    const billing = await completeVisitBilling(completed.id);

    const organizationId = requestOrganizationId();
    const amountNet = Number(completed.amountNet);
    if (organizationId && amountNet > 0 && billing.channel === "finance") {
      try {
        await createPaymentLink(
          {
            amountAzn: amountNet,
            sourceEntityType: "clinic_visit",
            sourceEntityId: completed.id,
            description: `Visit ${completed.patientRef.refCode}`,
          },
          { organizationId },
        );
      } catch {
        // optional
      }
      try {
        await createPortalLink(
          { entityType: "clinic_visit", entityId: completed.id },
          { organizationId },
        );
      } catch {
        // optional
      }
    }

    return sendJson(httpRes, { ...completed, billing });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
