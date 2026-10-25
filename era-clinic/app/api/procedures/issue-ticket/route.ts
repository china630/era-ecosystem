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
    const { dualRun, orders } = await listExtrasAwaitingTicket(
      session?.organizationId,
    );
    const locale = new URL(request.url).searchParams.get("locale") || "az";
    const catalogNames = await loadCatalogDisplayNameMap(
      orders.map((order) => order.procedureCode),
      locale,
    );
    return jsonOk({
      dualRun,
      count: orders.length,
      orders: orders.map((o) => ({
        id: o.id,
        procedureCode: o.procedureCode,
        procedureName: resolveOrderDisplayName(o, catalogNames),
        amountNet: Number(o.amountNet),
        patientOrigin: o.patientOrigin,
        status: o.status,
        scheduledAt: o.scheduledAt.toISOString(),
        resourceId: o.resourceId,
        patientRefId: o.patientRefId,
        patientName: o.patientRef.fullName,
        refCode: o.patientRef.refCode,
        roomNumber: o.clinicalEpisode?.roomNumber ?? null,
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

    const pending = await prisma.procedureOrder.count({
      where: { id: { in: body.orderIds }, status: "PENDING_PAY" },
    });
    const usePay = body.pay !== false && pending > 0;

    if (usePay) {
      const result = await payAndScheduleExtras(
        body.orderIds,
        session!.sub,
        session?.organizationId,
        { paymentReceiptRef: body.paymentReceiptRef, locale: body.locale },
      );
      return jsonOk({
        paid: result.accepted.length > 0,
        placed: result.placed,
        paymentReceiptRef: result.paymentReceiptRef,
        printPath: result.printPaths[0] ?? null,
        printPaths: result.printPaths,
        count: result.orders.length,
        accepted: result.accepted,
        rejected: result.rejected,
      });
    }

    const result = await issueExtraTickets(
      body.orderIds,
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
