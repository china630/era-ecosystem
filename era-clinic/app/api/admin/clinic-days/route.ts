import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";

const bodySchema = z.object({
  dayYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  closed: z.boolean(),
  endHour: z.number().int().min(0).max(23).nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const rows = await prisma.clinicDayOverride.findMany({ orderBy: { dayYmd: "asc" } });
    return jsonOk(rows);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function POST(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const body = bodySchema.parse(await req.json());
    const organizationId = requestOrganizationId();
    const row = await prisma.clinicDayOverride.upsert({
      where: { organizationId_dayYmd: { organizationId, dayYmd: body.dayYmd } },
      create: {
        organizationId,
        dayYmd: body.dayYmd,
        closed: body.closed,
        endHour: body.endHour ?? null,
        note: body.note ?? null,
      },
      update: {
        closed: body.closed,
        endHour: body.endHour ?? null,
        note: body.note ?? null,
      },
    });
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
