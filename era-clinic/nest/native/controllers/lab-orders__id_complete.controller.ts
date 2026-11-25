import { Controller, HttpCode, Post, Req, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { SATELLITE_CLINIC_LAB_ORDER_COMPLETED } from "@era/contracts";
import { assertRevenueEventForPublish } from "@era/satellite-kit";
import { requestOrganizationId } from "@/lib/request-organization";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { assertLabOrderDataScope } from "@/lib/auth/clinic-data-scope";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { createPaymentLink } from "@/integration/control-plane-platform.client";
import { findLabOrderWithPatientVisitItems, markLabOrderCompleted } from "@/domain/lab/lab-order-write.service";


function testCodesFromOrder(testCode: string): string[] {
  return testCode.split(",").map((c) => c.trim()).filter(Boolean);
}

@Controller()
export class LabOrdersIdCompleteController {

  @UseGuards(ClinicApiGuard)
  @Post("api/lab-orders/:id/complete")
  @HttpCode(200)
  async post_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      if (!session) throw new HttpException({ error: "Unauthorized" }, 401);
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_LAB_ORDERS_COMPLETE);
    if (denied) return clinicBody(denied);

    const { id } = httpReq.params;
    const scopeDenied = await assertLabOrderDataScope(session, id);
    if (scopeDenied) return clinicBody(scopeDenied);
    const order = await findLabOrderWithPatientVisitItems(id);
    if (!order) throw new HttpException({ error: "Lab order not found" }, 404);
    const { labAwaitingPaymentDenied } = await import("@/domain/lab/lab-order-pay-gate");
    const unpaid = labAwaitingPaymentDenied(order);
    if (unpaid) throw new HttpException({ error: unpaid.message, ...{ code: unpaid.code } }, unpaid.status);
    if (order.status === "COMPLETED") return order;
    if (order.status !== "PUBLISHED") {
      throw new HttpException({ error: 
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

    return completed;
  
        });
  }
}
