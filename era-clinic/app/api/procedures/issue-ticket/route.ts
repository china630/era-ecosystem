import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import {
  issueExtraTickets,
  listExtrasAwaitingTicket,
} from "@/domain/procedure/extra-ticket.service";
import {
  mapAttendanceHttpStatus,
  ProcedureAttendanceError,
} from "@/domain/procedure/procedure-attendance.service";
import { payAndScheduleExtras } from "@/domain/sanatorium/extras-assign.service";
import { PackageAssignError } from "@/domain/sanatorium/package-assign.service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_ISSUE_TICKET_READ,
    );
    if (denied) return denied;
    const { dualRun, orders } = await listExtrasAwaitingTicket(
      session?.organizationId,
    );
    return jsonOk({
      dualRun,
      count: orders.length,
      orders: orders.map((o) => ({
        id: o.id,
        procedureCode: o.procedureCode,
        procedureName: o.procedureName,
        amountNet: Number(o.amountNet),
        patientOrigin: o.patientOrigin,
        status: o.status,
        scheduledAt: o.scheduledAt.toISOString(),
        patientName: o.patientRef.fullName,
        refCode: o.patientRef.refCode,
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
});

export async function POST(request: Request) {
  try {
    const session = await getRouteSession();
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
        { paymentReceiptRef: body.paymentReceiptRef },
      );
      return jsonOk({
        paid: true,
        placed: result.placed,
        printPath: result.printPaths[0] ?? null,
        printPaths: result.printPaths,
        count: result.orders.length,
      });
    }

    const result = await issueExtraTickets(
      body.orderIds,
      session!.sub,
      session?.organizationId,
    );
    return jsonOk({
      dualRun: result.dualRun,
      paid: false,
      ticketId: result.ticketId,
      printPath:
        result.printPaths[0] ?? `/print/extra-ticket/${result.ticketId}?autoprint=1`,
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
