import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { listCashierQueue } from "@/domain/cashier/cashier-bill.service";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  patientRefId: z.string().optional(),
  origin: z.enum(["WALK_IN", "IN_HOUSE"]).optional(),
  channel: z
    .enum(["LOCAL", "FINANCE", "HOTEL_FOLIO", "SETTLEMENT_HUB"])
    .optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_CASHIER);
    if (denied) return denied;

    const url = new URL(req.url);
    const query = querySchema.parse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      patientRefId: url.searchParams.get("patientRefId") ?? undefined,
      origin: url.searchParams.get("origin") ?? undefined,
      channel: url.searchParams.get("channel") ?? undefined,
    });

    const result = await listCashierQueue(query);
    return jsonOk(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
