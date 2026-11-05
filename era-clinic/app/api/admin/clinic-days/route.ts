import { z } from "zod";
import { jsonOk, handleRouteError } from "@/lib/api-utils";
import { assertClinicAdminRoute } from "@/lib/auth/clinic-admin-guard";
import { listClinicDays } from "@/domain/planning/clinic-day";
import { prisma } from "@/lib/prisma";
import { requestOrganizationId } from "@/lib/request-organization";
import { addBakuDays } from "@/lib/baku-day";

const bodySchema = z.object({
  dayYmd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dayKind: z.enum(["WORKING", "SHORT", "CLOSED"]).optional(),
  closed: z.boolean().optional(),
  startHour: z.number().int().min(0).max(23).nullable().optional(),
  endHour: z.number().int().min(0).max(24).nullable().optional(),
  note: z.string().nullable().optional(),
});

export async function GET(req: Request) {
  try {
    const guard = await assertClinicAdminRoute(req);
    if (guard.error) return guard.error;
    const url = new URL(req.url);
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      const days = await listClinicDays(from, to < from ? addBakuDays(from, 1) : to);
      return jsonOk(days);
    }
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
    const dayKind =
      body.dayKind ??
      (body.closed === true ? "CLOSED" : body.closed === false ? "WORKING" : "WORKING");
    const closed = dayKind === "CLOSED";
    const row = await prisma.clinicDayOverride.upsert({
      where: { organizationId_dayYmd: { organizationId, dayYmd: body.dayYmd } },
      create: {
        organizationId,
        dayYmd: body.dayYmd,
        closed,
        dayKind,
        startHour: closed ? null : (body.startHour ?? null),
        endHour: closed ? null : (body.endHour ?? null),
        note: body.note ?? null,
      },
      update: {
        closed,
        dayKind,
        startHour: closed ? null : (body.startHour ?? null),
        endHour: closed ? null : (body.endHour ?? null),
        note: body.note ?? null,
      },
    });
    return jsonOk(row);
  } catch (err) {
    return handleRouteError(err);
  }
}
