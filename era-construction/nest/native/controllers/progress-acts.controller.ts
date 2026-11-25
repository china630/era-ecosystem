import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UseGuards,
} from "@nestjs/common";
import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import { SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";
import { trySendPlatformNotification } from "@/lib/platform-notify";
import {
  createPortalLink,
  createPaymentLink,
  createBookingSlot,
  createPromotion,
  createCustomDomain,
} from "@/integration/control-plane-platform.client";
import { progressActReopenDenied } from "@/lib/progress-act-status";
import {
  approveProgressAct,
  findProgressActWithProject,
  listProgressActLines,
  patchProgressActFinancePayApp,
  replaceProgressActLines,
} from "@/lib/progress-acts.service";
import type { StaffSession } from "@/lib/api-utils";
import { Staff } from "../decorators/staff-session.decorator";
import { ConstructionStaffGuard } from "../guards/staff.guard";
import { assertOk } from "../filters/construction-exception.filter";
import { withStaffTenant } from "../tenant";
import type { ConstructionRequest } from "../session";

const lineSchema = z.object({
  itemCode: z.string().min(1).max(64),
  description: z.string().min(1).max(500),
  qty: z.number().finite(),
  amountNet: z.number().finite(),
  boqLineId: z.string().min(1).optional().nullable(),
  sortOrder: z.number().int().optional(),
});

const putSchema = z.object({
  lines: z.array(lineSchema).min(1).max(500),
});

const approveBodySchema = z.object({
  customHostname: z.string().max(253).optional(),
});

const payAppSchema = z.object({
  financePayAppId: z.string().max(64).nullable().optional(),
});

@Controller("api/progress-acts/:id")
@UseGuards(ConstructionStaffGuard)
export class ProgressActsController {
  @Get("lines")
  getLines(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
  ) {
    return withStaffTenant(req, session, async () => {
      const act = await findProgressActWithProject(id);
      if (!act) throw new NotFoundException({ error: "Progress act not found" });
      const lines = await listProgressActLines(id);
      return { actId: id, amountNet: Number(act.amountNet), lines };
    });
  }

  @Put("lines")
  putLines(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = putSchema.parse(body ?? {});
      const result = await replaceProgressActLines(id, parsed.lines);
      return assertOk(result).act;
    });
  }

  @Patch("finance-payapp")
  patchPayApp(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = payAppSchema.parse(body ?? {});
      const result = await patchProgressActFinancePayApp(
        id,
        parsed.financePayAppId ?? null,
      );
      return assertOk(result).act;
    });
  }

  @Post("approve")
  approve(
    @Req() req: ConstructionRequest,
    @Staff() session: StaffSession,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return withStaffTenant(req, session, async () => {
      const parsed = approveBodySchema.parse(body ?? {});
      const existing = await findProgressActWithProject(id);
      if (!existing) throw new NotFoundException({ error: "Progress act not found" });
      if (existing.status === "APPROVED" || progressActReopenDenied(existing.status)) {
        return existing;
      }

      const approvedResult = await approveProgressAct(id);
      const approved = assertOk(approvedResult).act;

      await dispatchSatelliteEvent({
        type: SATELLITE_CONSTRUCTION_PROGRESS_ACT_APPROVED,
        payload: {
          projectId: approved.projectId,
          actId: approved.id,
          amountNet: Number(approved.amountNet),
          currency: "AZN",
          periodKey: approved.periodKey ?? undefined,
          contractId: approved.financeContractId ?? undefined,
          lines:
            approved.lines.length > 0
              ? approved.lines.map((line) => ({
                  itemCode: line.itemCode,
                  description: line.description,
                  qty: Number(line.qty),
                  amountNet: Number(line.amountNet),
                  boqLineId: line.boqLineId ?? undefined,
                }))
              : undefined,
        },
      });

      const organizationId = requestOrganizationId();
      const amountNet = Number(approved.amountNet);
      let payUrl: string | undefined;
      if (organizationId && amountNet > 0) {
        try {
          const link = (await createPaymentLink(
            {
              amountAzn: amountNet,
              sourceEntityType: "construction_progress_act",
              sourceEntityId: approved.id,
              description: `Act ${approved.periodKey ?? approved.id}`,
            },
            { organizationId },
          )) as { paymentUrl?: string; portalPayUrl?: string };
          payUrl = link.paymentUrl ?? link.portalPayUrl;
        } catch {
          payUrl = undefined;
        }
        try {
          await createPortalLink(
            { entityType: "construction_progress_act", entityId: approved.id },
            { organizationId },
          );
        } catch {
          /* optional */
        }
        try {
          await createBookingSlot(
            {
              resourceKey: "site-visit",
              resourceName: `Site visit ${approved.project.code}`,
              startsAt: new Date(Date.now() + 86400_000).toISOString(),
              endsAt: new Date(Date.now() + 90000_000).toISOString(),
              capacity: 4,
              metadata: { projectId: approved.projectId, actId: approved.id },
            },
            { organizationId },
          );
        } catch {
          /* optional */
        }
        try {
          await createPromotion(
            {
              code: `CON-ACT-${approved.id.slice(0, 8)}`,
              name: "Construction act promotion",
              discountType: "PERCENT",
              discountValue: 5,
              metadata: { actId: approved.id, projectId: approved.projectId },
            },
            { organizationId },
          );
        } catch {
          /* optional */
        }
        if (parsed.customHostname?.trim()) {
          try {
            await createCustomDomain(
              {
                hostname: parsed.customHostname.trim(),
                metadata: { actId: approved.id },
              },
              { organizationId },
            );
          } catch {
            /* optional */
          }
        }
      }

      await trySendPlatformNotification({
        templateKey: "construction.act.approved",
        channel: "EMAIL",
        messageClass: "FINANCIAL",
        recipient: approved.project.code,
        sourceEntityType: "construction_progress_act",
        sourceEntityId: approved.id,
        body: `Progress act approved: ${amountNet.toFixed(2)} AZN${payUrl ? ` — ${payUrl}` : ""}`,
        payload: {
          projectId: approved.projectId,
          periodKey: approved.periodKey,
          payUrl,
        },
      });

      return approved;
    });
  }
}
