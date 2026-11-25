import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { SATELLITE_CLINIC_VISIT_COMPLETED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { completeVisitBilling, resolveBillingTarget } from "@/lib/billing-router";
import { createPortalLink, createPaymentLink } from "@/integration/control-plane-platform.client";
import { completeLinkedAppointment, completeVisitRecord, getVisitForCompletion } from "@/domain/visit/visit.service";

@Controller()
export class VisitsIdCompleteController {

  @UseGuards(ClinicApiGuard)
  @Post("api/visits/:id/complete")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_VISITS);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const visit = await getVisitForCompletion(id);
    if (!visit) throw new HttpException({ error: "Visit not found" }, 404);
    if (visit.status === "COMPLETED") return visit;
    const { visitAwaitingPaymentDenied } = await import("@/domain/visit/visit-pay-gate");
    const unpaid = visitAwaitingPaymentDenied(visit);
    if (unpaid) throw new HttpException({ error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);

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

    return { ...completed, billing };
  
        });
  }
}
