import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
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
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const schema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(20),
  /** CLI-57: Pay → folio → schedule → ticket (default true for PENDING_PAY). */
  pay: z.boolean().optional(),
  /** Guest payment receipt / cheque reference (required for Pay). */
  paymentReceiptRef: z.string().min(1).max(200).optional(),
  locale: z.string().min(2).max(8).optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/procedures/issue-ticket", async (httpReq, httpRes) => {
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

  
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_READ,
    );
    if (denied) return denied;
    const url = new URL(request.url);
    const locale = url.searchParams.get("locale") || "az";
    const scopeRaw = url.searchParams.get("scope") || "due";
    const scope = (EXTRA_LIST_SCOPES as readonly string[]).includes(scopeRaw)
      ? (scopeRaw as ExtraListScope)
      : "due";
    const { dualRun, orders, needsFilter, needsDates } = await listExtrasAwaitingTicket(
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
    return sendJson(httpRes, {
      dualRun,
      needsFilter,
      needsDates,
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
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/procedures/issue-ticket", async (httpReq, httpRes) => {
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

  try {
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_WRITE,
    );
    if (denied) return denied;
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
      return sendJson(httpRes, { error: "One cheque is one patient", ...{ code: "MIXED_PATIENT" } }, 400);
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
      return sendJson(httpRes, {
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
      });
    }

    const result = await issueExtraTickets(
      procedureIds,
      session!.sub,
      session?.organizationId,
      body.locale,
    );
    return sendJson(httpRes, {
      dualRun: result.dualRun,
      paid: false,
      ticketId: result.ticketId,
      printPath:
        result.printPaths[0] ??
        extraTicketPrintPath(result.ticketId, session!.organizationId!),
      printPaths: result.printPaths,
      count: result.orders.length,
    });
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return sendJson(httpRes, { error: err.message, ...{
        code: err.code,
      } }, mapAttendanceHttpStatus(err));
    }
    if (err instanceof PackageAssignError) {
      return sendJson(httpRes, { error: err.message, ...{ code: err.code } }, err.status);
    }
    return sendRouteError(httpRes, err);
  }

        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
