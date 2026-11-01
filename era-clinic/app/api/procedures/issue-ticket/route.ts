import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getSatelliteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  issueExtraTickets,
  listExtrasAwaitingTicket,
} from "@/domain/procedure/extra-ticket.service";
import { extraTicketPrintPath } from "@/domain/procedure/extra-ticket";
import {
  mapAttendanceHttpStatus,
  ProcedureAttendanceError,
} from "@/domain/procedure/procedure-attendance.service";
import { payAndScheduleExtras } from "@/domain/sanatorium/extras-assign.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { payDiagnosticsExtras } from "@/domain/sanatorium/diagnostics-extras.service";
import { prisma } from "@/lib/prisma";
import {
  loadCatalogDisplayNameMap,
  resolveOrderDisplayName,
} from "@/domain/catalog/catalog-display-name.service";

export async function GET(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_READ,
    );
    if (denied) return denied;
    const url = new URL(request.url);
    const locale = url.searchParams.get("locale") || "az";
    const { dualRun, orders, needsFilter } = await listExtrasAwaitingTicket(
      session?.organizationId,
      {
        room: url.searchParams.get("room"),
        q: url.searchParams.get("q"),
        locale,
      },
    );
    const catalogNames = await loadCatalogDisplayNameMap(
      orders.filter((o) => o.kind === "procedure").map((order) => order.procedureCode),
      locale,
    );
    return jsonOk({
      dualRun,
      needsFilter,
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
  } catch (err) {
    return handleRouteError(err);
  }
}

const schema = z.object({
  orderIds: z.array(z.string().min(1)).min(1).max(20),
  /** CLI-57: Pay → folio → schedule → ticket (default true for PENDING_PAY). */
  pay: z.boolean().optional(),
  /** Guest payment receipt / cheque reference (required for Pay). */
  paymentReceiptRef: z.string().min(1).max(200).optional(),
  locale: z.string().min(2).max(8).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await getSatelliteSession();
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_WRITE,
    );
    if (denied) return denied;
    const body = schema.parse(await request.json());

    const [procedureOrders, labOrders, visitOrders] = await Promise.all([
      prisma.procedureOrder.findMany({
        where: { id: { in: body.orderIds } },
        select: { id: true, status: true, patientRefId: true },
      }),
      prisma.labOrder.findMany({
        where: {
          id: { in: body.orderIds },
          amountNet: { gt: 0 },
          settledAt: null,
          inPackage: false,
        },
        select: { id: true, patientRefId: true },
      }),
      prisma.visit.findMany({
        where: {
          id: { in: body.orderIds },
          amountNet: { gt: 0 },
          settledAt: null,
          NOT: { serviceLines: { some: { inPackage: true } } },
        },
        select: { id: true, patientRefId: true },
      }),
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
      return jsonError("One cheque is one patient", 400, { code: "MIXED_PATIENT" });
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
      return jsonOk({
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
    return jsonOk({
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
      return jsonError(err.message, mapAttendanceHttpStatus(err), {
        code: err.code,
      });
    }
    if (err instanceof PackageAssignError) {
      return jsonError(err.message, err.status, { code: err.code });
    }
    return handleRouteError(err);
  }
}
