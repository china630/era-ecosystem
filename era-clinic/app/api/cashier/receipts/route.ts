import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonOk,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { listReceipts } from "@/domain/cashier/cashier-settle.service";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: z.enum(["OPEN", "PAID", "VOID"]).optional(),
  shiftId: z.string().optional(),
  patientRefId: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [CLINIC_ROLE.RECEPTION]);
    if (denied) return denied;

    const url = new URL(req.url);
    const query = querySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      shiftId: url.searchParams.get("shiftId") ?? undefined,
      patientRefId: url.searchParams.get("patientRefId") ?? undefined,
    });

    const result = await listReceipts(query);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
