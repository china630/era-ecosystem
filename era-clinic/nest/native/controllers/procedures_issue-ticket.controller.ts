import { Controller, Get, HttpCode, Post, Req, Res, UseGuards, HttpException } from "@nestjs/common";
import { ClinicApiGuard, readClinicSession } from "../clinic-api.guard";
import type { Request } from "express";
import {
  withClinicStaff,
  clinicBody,
} from "../../bridge";
import { z } from "zod";
import { handleRouteError, requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { EXTRA_LIST_SCOPES, type ExtraListScope } from "@/domain/procedure/extra-ticket";
import { issueExtraTickets, listExtrasAwaitingTicket } from "@/domain/procedure/extra-ticket.service";
import { extraTicketPrintPath } from "@/domain/procedure/extra-ticket";
import { mapAttendanceHttpStatus, ProcedureAttendanceError } from "@/domain/procedure/procedure-attendance.service";
import { payAndScheduleExtras } from "@/domain/sanatorium/extras-assign.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { payDiagnosticsExtras } from "@/domain/sanatorium/diagnostics-extras.service";
import { loadCatalogDisplayNameMap, resolveOrderDisplayName } from "@/domain/catalog/catalog-display-name.service";
import { findProcedureOrdersForTicketIssue, findUnsettledLabOrdersForTicketIssue, findUnsettledVisitOrdersForTicketIssue } from "@/domain/procedure/procedure-order.service";


const schema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(20),
  /** CLI-57: Pay → folio → schedule → ticket (default true for PENDING_PAY). */
  pay: z.boolean().optional(),
  /** Guest payment receipt / cheque reference (required for Pay). */
  paymentReceiptRef: z.string().min(1).max(200).optional(),
  locale: z.string().min(2).max(8).optional(),
});

@Controller()
export class ProceduresIssueTicketController {

  @UseGuards(ClinicApiGuard)
  @Get("api/procedures/issue-ticket")
  @HttpCode(200)
  async get_0(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_READ,
    );
    if (denied) return clinicBody(denied);
    const url = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
    const locale = url.searchParams.get("locale") || "az";
    const scopeRaw = url.searchParams.get("scope") || "due";
    const scope = (EXTRA_LIST_SCOPES as readonly string[]).includes(scopeRaw)
      ? (scopeRaw as ExtraListScope)
      : "due";
    const { dualRun, orders, needsFilter, needsDates, truncated } = await listExtrasAwaitingTicket(
      session?.organizationId,
      {
        room: url.searchParams.get("room"),
        q: url.searchParams.get("q"),
        locale,
        scope,
        dateFrom: url.searchParams.get("dateFrom"),
        dateTo: url.searchParams.get("dateTo"),
      },
    );
    const catalogNames = await loadCatalogDisplayNameMap(
      orders.filter((o) => o.kind === "procedure").map((order) => order.procedureCode),
      locale,
    );
    return {
      dualRun,
      needsFilter,
      needsDates,
      truncated,
      scope,
      count: orders.length,
      orders: orders.map((o) => ({
        id: o.id,
        kind: o.kind,
        procedureCode: o.procedureCode,
        procedureName:
          o.kind === "procedure"
            ? resolveOrderDisplayName(
                {
                  procedureCode: o.procedureCode,
                  procedureName: o.procedureName,
                },
                catalogNames,
              )
            : o.procedureName,
        amountNet: Number(o.amountNet),
        patientOrigin: o.patientOrigin,
        status: o.status,
        bucket: o.bucket,
        printPath: o.printPath,
        scheduledAt: o.scheduledAt.toISOString(),
        resourceId: o.resourceId,
        patientRefId: o.patientRefId,
        patientName: o.patientRef.fullName,
        refCode: o.patientRef.refCode,
        roomNumber: o.clinicalEpisode?.roomNumber ?? null,
        clinicalEpisodeId: o.clinicalEpisodeId,
        extraTicketIssuedAt: o.extraTicketIssuedAt,
      })),
    };
  
        });
  }

  @UseGuards(ClinicApiGuard)
  @Post("api/procedures/issue-ticket")
  @HttpCode(200)
  async post_1(
    @Req() httpReq: Request,
  ) {
    const session = readClinicSession(httpReq);
    return withClinicStaff(httpReq, session, async () => {
      try {
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_WRITE,
    );
    if (denied) return clinicBody(denied);
    const body = schema.parse(httpReq.body);

    const [procedureOrders, labOrders, visitOrders] = await Promise.all([
      findProcedureOrdersForTicketIssue(body.orderIds),
      findUnsettledLabOrdersForTicketIssue(body.orderIds),
      findUnsettledVisitOrdersForTicketIssue(body.orderIds),
    ]);
    const procedureIds = procedureOrders.map((row) => row.id);
    const diagnosticLines = [
      ...labOrders.map((row) => ({ id: row.id, kind: "lab" as const })),
      ...visitOrders.map((row) => ({ id: row.id, kind: "visit" as const })),
    ];
    const patientIds = new Set(
      [
        ...procedureOrders.map((row) => row.patientRefId),
        ...labOrders.map((row) => row.patientRefId),
        ...visitOrders.map((row) => row.patientRefId),
      ].filter(Boolean),
    );
    if (patientIds.size > 1) {
      throw new HttpException({ error: "One cheque is one patient", ...{ code: "MIXED_PATIENT" } }, 400);
    }

    const pending = procedureOrders.filter((row) => row.status === "PENDING_PAY").length;
    const usePay = body.pay !== false && (pending > 0 || diagnosticLines.length > 0);

    if (usePay) {
      const procedureResult =
        procedureIds.length > 0
          ? await payAndScheduleExtras(
              procedureIds,
              session!.sub,
              session?.organizationId,
              { paymentReceiptRef: body.paymentReceiptRef, locale: body.locale },
            )
          : null;
      const diagnosticResult =
        diagnosticLines.length > 0
          ? await payDiagnosticsExtras(
              diagnosticLines,
              session!.sub,
              session?.organizationId,
            )
          : null;
      return {
        paid:
          (procedureResult?.accepted.length ?? 0) +
            (diagnosticResult?.accepted.length ?? 0) >
          0,
        placed: procedureResult?.placed ?? 0,
        paymentReceiptRef:
          procedureResult?.paymentReceiptRef ??
          diagnosticResult?.paymentReceiptRef ??
          null,
        printPath: procedureResult?.printPaths[0] ?? null,
        printPaths: procedureResult?.printPaths ?? [],
        count:
          (procedureResult?.orders.length ?? 0) +
          (diagnosticResult?.accepted.length ?? 0),
        accepted: [
          ...(procedureResult?.accepted ?? []),
          ...(diagnosticResult?.accepted ?? []),
        ],
        rejected: [
          ...(procedureResult?.rejected ?? []),
          ...(diagnosticResult?.rejected ?? []),
        ],
      };
    }

    const result = await issueExtraTickets(
      procedureIds,
      session!.sub,
      session?.organizationId,
      body.locale,
    );
    return {
      dualRun: result.dualRun,
      paid: false,
      ticketId: result.ticketId,
      printPath:
        result.printPaths[0] ??
        extraTicketPrintPath(result.ticketId, session!.organizationId!),
      printPaths: result.printPaths,
      count: result.orders.length,
    };
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof ProcedureAttendanceError) {
      throw new HttpException({ error: err.message, ...{
        code: err.code,
      } }, mapAttendanceHttpStatus(err));
    }
    if (err instanceof PackageAssignError) {
      throw new HttpException({ error: err.message, ...{ code: err.code } }, err.status);
    }
    return clinicBody(handleRouteError(err));
  }

        });
  }
}
