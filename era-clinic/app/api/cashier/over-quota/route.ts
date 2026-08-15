import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonOk,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  unsettledOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  overQuotaOnly: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v !== "false"),
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
      unsettledOnly: url.searchParams.get("unsettledOnly") ?? undefined,
      overQuotaOnly: url.searchParams.get("overQuotaOnly") ?? undefined,
    });

    const createdAt: { gte?: Date; lt?: Date } = {};
    if (query.dateFrom) createdAt.gte = new Date(`${query.dateFrom}T00:00:00.000Z`);
    if (query.dateTo) {
      const end = new Date(`${query.dateTo}T00:00:00.000Z`);
      end.setUTCDate(end.getUTCDate() + 1);
      createdAt.lt = end;
    }

    const where = {
      ...(query.overQuotaOnly !== false ? { overQuota: true } : {}),
      ...(query.unsettledOnly ? { settledLocally: false } : {}),
      ...(Object.keys(createdAt).length ? { createdAt } : {}),
    };

    const [total, data] = await Promise.all([
      prisma.procedureChargeLog.count({ where }),
      prisma.procedureChargeLog.findMany({
        where,
        include: {
          patientRef: { select: { id: true, refCode: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);

    return jsonOk({ data, total, page: query.page, pageSize: query.pageSize });
  } catch (err) {
    return handleRouteError(err);
  }
}
