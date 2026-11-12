import { z } from "zod";
import { requireClinicPermission } from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { resolveProcedureAmount } from "@/domain/catalog/catalog-price.service";
import { createManualProcedureOrder, deleteProcedureOrderById, findBodyPartLookupsByCodes, findOpenPackageBalance, findPhysioListItemsByIds, findPractitionerIdByUserId, findProcedureTypeByCode, getProcedureOrderWithPatient, listProcedureOrdersForDay } from "@/domain/procedure/procedure-order.service";
import { loadCatalogDisplayNameMap, resolveOrderDisplayName } from "@/domain/catalog/catalog-display-name.service";
import { stampEpisodeOnCreate } from "@/domain/sanatorium/episode-stamp";
import { bakuDayBounds, todayBakuYmd } from "@/domain/ops/day-summary.service";
import type { ProcedureOrderStatus, Prisma } from "@prisma/client";
import { autoCompleteElapsedCheckedIn } from "@/domain/procedure/procedure-completion.service";
import { getCheckInOpenState } from "@/domain/procedure/procedure-attendance.service";
import { buildNurseInstruction } from "@/domain/procedure/nurse-order-instruction";
import { readPhysioFields } from "@/domain/physio/physio-order-fields";
import { getSchedulingSettings } from "@/domain/settings/scheduling-settings";
import { enterClinicStaff, clinicNestSession, nestHeader, nestQuery, readNestForm, rejectMissingAgency, runWithClinicTenant, runWithNestHttp, runWithStaffTenantIfPresent, sendBytes, sendJson, sendRouteError, sendWebResponse } from "../bridge";

const ACTIVE_STATUSES: ProcedureOrderStatus[] = ["SCHEDULED", "CHECKED_IN"];
const ALL_FILTER_STATUSES: ProcedureOrderStatus[] = [
  "SCHEDULED",
  "CHECKED_IN",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
  "PENDING_PAY",
];



const createSchema = z.object({
  patientRefId: z.string(),
  procedureCode: z.string(),
  procedureName: z.string(),
  scheduledAt: z.string().datetime(),
  patientOrigin: z.enum(["WALK_IN", "IN_HOUSE"]).default("WALK_IN"),
  reservationId: z.string().optional(),
  amountNet: z.number().nonnegative().optional(),
});

export function register(http: { get: Function; post: Function; put: Function; patch: Function; delete: Function }) {
  http.get("/api/procedures", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const request = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_PROCEDURES_READ);
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
      const practitioner = await findPractitionerIdByUserId(session!.sub);
      if (!practitioner) {
        return sendJson(httpRes, { date, count: 0, orders: [], mineUnlinked: true });
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

    // HOLD_UNTIL_PAY rows have no cabin and stay off every nurse board.
    const seatedUnpaidOnly: Prisma.ProcedureOrderWhereInput = {
      OR: [{ status: { not: "PENDING_PAY" } }, { resourceId: { not: null } }],
    };
    if (mine) {
      where.AND = [
        seatedUnpaidOnly,
        {
          OR: [
            { inPackage: true },
            { extraTicketIssuedAt: { not: null } },
            { status: "PENDING_PAY", resourceId: { not: null } },
          ],
        },
      ];
    } else {
      where.AND = [seatedUnpaidOnly];
    }

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

    const orders = await listProcedureOrdersForDay(where);

    const catalogNames = await loadCatalogDisplayNameMap(
      orders.map((o) => o.procedureCode),
      locale,
    );
    const listIds = [
      ...new Set(
        orders.flatMap((o) => {
          const fields = readPhysioFields(o.physioFields);
          return [fields.deviceProgramId, fields.substanceId].filter(
            (id): id is string => Boolean(id),
          );
        }),
      ),
    ];
    const bodyCodes = [
      ...new Set(orders.map((o) => o.bodyPart).filter((code): code is string => Boolean(code))),
    ];
    const [listItems, bodyRows] = await Promise.all([
      findPhysioListItemsByIds(listIds),
      findBodyPartLookupsByCodes(bodyCodes),
    ]);
    const listTitles = new Map(listItems.map((row) => [row.id, row]));
    const bodyNames = new Map(bodyRows.map((row) => [row.code, row.name]));
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
          instruction: buildNurseInstruction({
            locale,
            bodyPartName: o.bodyPart ? (bodyNames.get(o.bodyPart) ?? o.bodyPart) : null,
            siteApplyMode: o.siteApplyMode,
            note: o.note,
            physioFields: o.physioFields,
            sites: o.sites,
            listTitles,
          }),
        };
      }),
    );

    return sendJson(httpRes, {
      date,
      count: enriched.length,
      orders: enriched,
      dayStartHour: settings.dayStartHour,
      dayEndHour: settings.dayEndHour,
      /** @deprecated tenant default; prefer per-order resourceGapMinutes */
      procedureGapMinutes: settings.defaultProcedureGapMinutes ?? 5,
    });
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
  http.post("/api/procedures", async (httpReq, httpRes) => {
    if (!(await enterClinicStaff(httpReq, httpRes))) return;
    try {
      const session = await clinicNestSession(httpReq);
      const web = await runWithClinicTenant(session, async () => {
        return runWithNestHttp(httpReq, async () => {
      const requestUrl = new URL(httpReq.originalUrl ?? httpReq.url ?? "/", "http://127.0.0.1");
      const req = {
        url: requestUrl.toString(),
        method: httpReq.method,
        nextUrl: requestUrl,
        headers: { get: (name: string) => nestHeader(httpReq, name) },
        json: async () => httpReq.body,
        text: async () => (typeof httpReq.body === "string" ? httpReq.body : JSON.stringify(httpReq.body ?? "")),
      };

  
    const denied = await requireClinicPermission(
      session,
      CLINIC_PERMISSION.API_PROCEDURES_RECEPTION,
    );
    if (denied) return denied;
    const body = createSchema.parse(httpReq.body);

    // Wave C/E: package-quota codes cannot land SCHEDULED via manual POST — doctor confirm only.
    if (body.reservationId || body.patientRefId) {
      const balance = await findOpenPackageBalance({
        procedureCode: body.procedureCode,
        patientRefId: body.patientRefId,
        reservationId: body.reservationId,
      });
      if (balance && balance.quotaUsed < balance.quotaTotal) {
        return sendJson(httpRes, { error: 
          "Package procedures must be assigned from the package modal (cannot manual-schedule in-quota codes)" }, 409);
      }
    }

    const day = new Date(body.scheduledAt);
    const ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Baku",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(day);

    let amountNet = body.amountNet;
    if (amountNet == null) {
      const resolved = await resolveProcedureAmount(body.procedureCode);
      amountNet = resolved.amountNet;
    }
    const clinicalEpisodeId = await stampEpisodeOnCreate({
      patientRefId: body.patientRefId,
      reservationId: body.reservationId,
    });
    if (clinicalEpisodeId) {
      const {
        CARE_TEAM_REQUIRED,
        episodeCareTeamDenied,
      } = await import("@/domain/sanatorium/episode-care-team-gates");
      const { countEpisodeCareDoctors } = await import(
        "@/domain/sanatorium/episode-care-team.service"
      );
      const careDenied = episodeCareTeamDenied(
        await countEpisodeCareDoctors(clinicalEpisodeId),
      );
      if (careDenied) {
        return sendJson(httpRes, { error: careDenied, ...{ code: CARE_TEAM_REQUIRED } }, 409);
      }
      const { procedureLaneDenial } = await import("@/domain/sanatorium/lane-gates");
      const deniedAn = await procedureLaneDenial(clinicalEpisodeId);
      if (deniedAn) {
        return sendJson(httpRes, { error: deniedAn.message, ...{ code: deniedAn.code } }, 409);
      }
    }
    const { clinicDayIsClosed, SlotDecisionError, SLOT_REASON_MESSAGE } = await import(
      "@/domain/planning/slot-decision"
    );
    if (await clinicDayIsClosed(ymd)) {
      throw new SlotDecisionError("closed");
    }

    const pt = await findProcedureTypeByCode(body.procedureCode);
    const order = await createManualProcedureOrder({
      patientRefId: body.patientRefId,
      clinicalEpisodeId: clinicalEpisodeId ?? undefined,
      procedureTypeId: pt?.id,
      procedureCode: body.procedureCode,
      procedureName: body.procedureName,
      scheduledAt: new Date(body.scheduledAt),
      patientOrigin: body.patientOrigin,
      reservationId: body.reservationId,
      amountNet: amountNet ?? 0,
      schedulingMode: pt?.openAttendance === true ? "OPEN" : "FIXED",
    });

    const { placeOrPinOrders } = await import("@/domain/procedure/place-or-pin-orders");
    const seated = await placeOrPinOrders([order.id], {
      confirmedByUserId: session!.sub,
      pinYmdByOrderId: { [order.id]: ymd },
      pinStrict: true,
    });
    if (seated.placed === 0) {
      await deleteProcedureOrderById(order.id);
      const reason = seated.failures[0]?.reason ?? "no_slot";
      const known = reason in SLOT_REASON_MESSAGE ? reason : "no_slot";
      throw new SlotDecisionError(
        known as keyof typeof SLOT_REASON_MESSAGE,
        SLOT_REASON_MESSAGE[known as keyof typeof SLOT_REASON_MESSAGE],
      );
    }

    const seatedOrder = await getProcedureOrderWithPatient(order.id);
    return sendJson(httpRes, seatedOrder ?? order, 201);
  
        });
      });
      if (web instanceof Response) await sendWebResponse(httpRes, web);
    } catch (err) {
      await sendRouteError(httpRes, err);
    }
  });
}
