import { z } from "zod";
import { requestOrganizationId } from "@/lib/request-organization";
import {
  jsonOk,
  jsonError,
  handleRouteError,
  getRouteSession,
  requireClinicRole,
} from "@/lib/api-utils";
import { CLINIC_ROLE } from "@/lib/clinic-roles";
import { prisma } from "@/lib/prisma";
import { resolveProcedureAmount } from "@/domain/catalog/catalog-price.service";
import {
  loadCatalogDisplayNameMap,
  resolveOrderDisplayName,
} from "@/domain/catalog/catalog-display-name.service";
import {
  bakuDayBounds,
  todayBakuYmd,
} from "@/domain/ops/day-summary.service";
import type { ProcedureOrderStatus, Prisma } from "@prisma/client";
import { autoCompleteElapsedCheckedIn } from "@/domain/procedure/procedure-completion.service";
import { getCheckInOpenState } from "@/domain/procedure/procedure-attendance.service";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";

const ACTIVE_STATUSES: ProcedureOrderStatus[] = ["SCHEDULED", "CHECKED_IN"];
const ALL_FILTER_STATUSES: ProcedureOrderStatus[] = [
  "SCHEDULED",
  "CHECKED_IN",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
];

export async function GET(request: Request) {
  try {
    const session = await getRouteSession();
    const denied = requireClinicRole(session, [
      CLINIC_ROLE.NURSE,
      CLINIC_ROLE.DOCTOR,
      CLINIC_ROLE.RECEPTION,
      CLINIC_ROLE.FLOOR,
    ]);
    if (denied) return denied;

    // Lazy catch-up: CHECKED_IN past endsAt → COMPLETED before listing.
    await autoCompleteElapsedCheckedIn().catch(() => null);

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date")?.trim() || todayBakuYmd();
    const statusParam = url.searchParams.get("status")?.trim();
    const patientQ = url.searchParams.get("patient")?.trim();
    const procedureQ = url.searchParams.get("procedure")?.trim();
    const overdueOnly = url.searchParams.get("overdueOnly") === "1";
    const resourceId = url.searchParams.get("resourceId")?.trim();
    const practitionerIdParam = url.searchParams.get("practitionerId")?.trim();
    const mine = url.searchParams.get("mine") === "1" && !practitionerIdParam;
    const locale =
      url.searchParams.get("locale") ??
      request.headers.get("x-era-locale") ??
      "en";

    const { start, end, date } = bakuDayBounds(dateParam);

    let minePractitionerId: string | null = null;
    if (mine) {
      const practitioner = await prisma.practitioner.findFirst({
        where: { userId: session!.sub },
        select: { id: true },
      });
      if (!practitioner) {
        return jsonOk({ date, count: 0, orders: [], mineUnlinked: true });
      }
      minePractitionerId = practitioner.id;
    }

    const staffPractitionerId = practitionerIdParam || minePractitionerId;

    let statuses: ProcedureOrderStatus[] = ACTIVE_STATUSES;
    if (statusParam && statusParam.toUpperCase() !== "ACTIVE") {
      if (statusParam.toUpperCase() === "ALL") {
        statuses = ALL_FILTER_STATUSES;
      } else {
        const parsed = statusParam
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s): s is ProcedureOrderStatus =>
            (ALL_FILTER_STATUSES as string[]).includes(s),
          );
        if (parsed.length > 0) statuses = parsed;
      }
    }

    const where: Prisma.ProcedureOrderWhereInput = {
      scheduledAt: { gte: start, lt: end },
      status: { in: statuses },
    };

    if (patientQ) {
      where.patientRef = {
        OR: [
          { fullName: { contains: patientQ, mode: "insensitive" } },
          { refCode: { contains: patientQ, mode: "insensitive" } },
        ],
      };
    }

    if (procedureQ) {
      where.OR = [
        { procedureCode: { contains: procedureQ, mode: "insensitive" } },
        { procedureName: { contains: procedureQ, mode: "insensitive" } },
      ];
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (staffPractitionerId) {
      where.allocations = {
        some: { role: "STAFF", practitionerId: staffPractitionerId },
      };
    }

    if (overdueOnly) {
      where.status = "SCHEDULED";
      // Past check-in grace is refined client-side / overdue endpoint; here use scheduledAt < now
      where.scheduledAt = { gte: start, lt: new Date() };
    }

    const orders = await prisma.procedureOrder.findMany({
      where,
      include: {
        patientRef: true,
        resource: { select: { id: true, code: true, name: true } },
        allocations: {
          where: { role: "STAFF" },
          select: { practitionerId: true, role: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
      take: 500,
    });

    const catalogNames = await loadCatalogDisplayNameMap(
      orders.map((o) => o.procedureCode),
      locale,
    );
    const settings = await getSchedulingSettings();
    const enriched = await Promise.all(
      orders.map(async (o) => {
        const checkIn = await getCheckInOpenState(o);
        return {
          ...o,
          procedureName: resolveOrderDisplayName(o, catalogNames),
          checkInOpen: checkIn.open,
          checkInDeadline: checkIn.deadline.toISOString(),
          effectiveEndsAt: checkIn.endsAt.toISOString(),
          resourceGapMinutes: checkIn.resourceGapMinutes,
          procedureGapMinutes: checkIn.resourceGapMinutes,
          dayStartHour: settings.dayStartHour,
          dayEndHour: settings.dayEndHour,
        };
      }),
    );

    return jsonOk({
      date,
      count: enriched.length,
      orders: enriched,
      dayStartHour: settings.dayStartHour,
      dayEndHour: settings.dayEndHour,
      /** @deprecated tenant default; prefer per-order resourceGapMinutes */
      procedureGapMinutes: settings.defaultProcedureGapMinutes ?? 5,
    });
  } catch (err) {
    return handleRouteError(err);
  }
}

const createSchema = z.object({
  patientRefId: z.string(),
  procedureCode: z.string(),
  procedureName: z.string(),
  scheduledAt: z.string().datetime(),
  patientOrigin: z.enum(["WALK_IN", "IN_HOUSE"]).default("WALK_IN"),
  reservationId: z.string().optional(),
  amountNet: z.number().nonnegative().optional(),
});

export async function POST(req: Request) {
  try {
    await getRouteSession();
    const body = createSchema.parse(await req.json());

    // Wave C/E: package-quota codes cannot land SCHEDULED via manual POST — doctor confirm only.
    // Scope balance to this patient's OPEN instance when patientRefId known (not reservation findFirst).
    if (body.reservationId || body.patientRefId) {
      const balance = await prisma.programProcedureBalance.findFirst({
        where: {
          procedureCode: body.procedureCode,
          instance: body.patientRefId
            ? { episode: { patientRefId: body.patientRefId, status: "OPEN" } }
            : { reservationId: body.reservationId! },
        },
      });
      if (balance && balance.quotaUsed < balance.quotaTotal) {
        return jsonError(
          "Package procedures must be doctor-confirmed from PROPOSED (cannot manual-schedule in-quota codes)",
          409,
        );
      }
    }

    let amountNet = body.amountNet;
    if (amountNet == null) {
      const resolved = await resolveProcedureAmount(body.procedureCode);
      amountNet = resolved.amountNet;
    }
    const order = await prisma.procedureOrder.create({
      data: {
        organizationId: requestOrganizationId(),
        patientRefId: body.patientRefId,
        procedureCode: body.procedureCode,
        procedureName: body.procedureName,
        scheduledAt: new Date(body.scheduledAt),
        patientOrigin: body.patientOrigin,
        reservationId: body.reservationId,
        amountNet,
      },
      include: { patientRef: true },
    });
    return jsonOk(order, 201);
  } catch (err) {
    return handleRouteError(err);
  }
}
