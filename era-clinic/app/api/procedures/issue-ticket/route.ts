import { z } from "zod";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import {
  issueExtraTickets,
  listExtrasAwaitingTicket,
} from "@/domain/procedure/extra-ticket.service";
import {
  mapAttendanceHttpStatus,
  ProcedureAttendanceError,
} from "@/domain/procedure/procedure-attendance.service";

export async function GET() {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [
      CLINIC_ROLE.RECEPTION,
      CLINIC_ROLE.NURSE,
      CLINIC_ROLE.DOCTOR,
    ]);
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
});

export async function POST(request: Request) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION]);
    if (denied) return denied;
    const body = schema.parse(await request.json());
    const result = await issueExtraTickets(
      body.orderIds,
      session!.sub,
      session?.organizationId,
    );
    return jsonOk({
      dualRun: result.dualRun,
      ticketId: result.ticketId,
      printPath: result.printPaths[0] ?? `/print/extra-ticket/${result.ticketId}?autoprint=1`,
      printPaths: result.printPaths,
      count: result.orders.length,
    });
  } catch (err) {
    if (err instanceof ProcedureAttendanceError) {
      return jsonError(err.message, mapAttendanceHttpStatus(err), { code: err.code });
    }
    return handleRouteError(err);
  }
}
