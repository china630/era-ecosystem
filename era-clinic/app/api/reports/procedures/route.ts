import { z } from "zod";
import {
  getRouteSession,
  handleRouteError,
  jsonError,
  jsonOk,
  requireClinicPermission,
  sessionHasClinicPermission,
} from "@/lib/api-utils";
import { CLINIC_PERMISSION } from "@/lib/auth/clinic-permissions";
import { prisma } from "@/lib/prisma";
import { bakuDayBounds, todayBakuYmd } from "@/lib/baku-day";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function formatBakuYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

const viewSchema = z.enum([
  "doctor-lines",
  "doctor-bonus",
  "by-procedure",
  "nurse-work",
]);

export async function GET(req: Request) {
  try {
    const session = await getRouteSession();
    const denied = await requireClinicPermission(session, CLINIC_PERMISSION.API_REPORTS_PROCEDURES);
    if (denied) return denied;
    if (!session) return jsonError("Unauthorized", 401);

    const url = new URL(req.url);
    const viewRaw = (url.searchParams.get("view") ?? "doctor-lines").trim();
    const view = viewSchema.parse(viewRaw);

    const from = (url.searchParams.get("from") ?? todayBakuYmd()).trim();
    const to = (url.searchParams.get("to") ?? from).trim();
    if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
      return jsonError("from and to must be YYYY-MM-DD", 400);
    }

    const { start } = bakuDayBounds(from);
    const { end } = bakuDayBounds(to);

    const procedureCode = url.searchParams.get("procedure")?.trim() || undefined;
    const paid = url.searchParams.get("paid")?.trim(); // "paid" | "free"
    const origin = url.searchParams.get("origin")?.trim() || undefined; // WALK_IN | IN_HOUSE
    const procedureQ = procedureCode;

    const doctorIdParam = url.searchParams.get("doctorId")?.trim() || undefined;
    const nurseIdParam = url.searchParams.get("nurseId")?.trim() || undefined;

    const myDoctorPractitionerId =
      sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_DOCTOR)
        ? (
            await prisma.practitioner.findFirst({
              where: { userId: session.sub },
              select: { id: true, staffKind: true },
            })
          )?.id ?? null
        : null;

    const resolveDoctorPractitionerId = async (): Promise<string | null> => {
      // Doctors (screen:doctor) are scoped to self; others may filter by doctorId.
      if (sessionHasClinicPermission(session, CLINIC_PERMISSION.SCREEN_DOCTOR)) {
        return myDoctorPractitionerId;
      }
      return doctorIdParam ?? null;
    };

    if (view === "doctor-lines") {
      const doctorId = await resolveDoctorPractitionerId();
      if (!doctorId) return jsonOk({ view, items: [], grandTotal: 0 });

      const statusFilterRaw = url.searchParams.get("status")?.trim();
      const statusFilter = statusFilterRaw
        ? statusFilterRaw.toUpperCase()
        : "ALL";

      const statusToDb = (s: string | null) => {
        switch (s) {
          case "COMPLETED":
            return ["COMPLETED"] as const;
          case "CANCELLED":
            return ["CANCELLED"] as const;
          case "PENDING":
            return ["PROPOSED", "SCHEDULED"] as const;
          case "NO_SHOW":
            return ["NO_SHOW"] as const;
          default:
            return ["PROPOSED", "SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
        }
      };

      const statuses = statusToDb(statusFilter);

      const orders = await prisma.procedureOrder.findMany({
        where: {
          prescribedByPractitionerId: doctorId,
          scheduledAt: { gte: start, lt: end },
          status: { in: statuses as any },
          ...(procedureQ ? { procedureCode: procedureQ } : {}),
          ...(origin ? { patientOrigin: origin as any } : {}),
          ...(paid
            ? paid === "paid"
              ? { amountNet: { gt: 0 } }
              : paid === "free"
                ? { amountNet: { lte: 0 } }
                : {}
            : {}),
        },
        select: {
          procedureCode: true,
          procedureName: true,
          scheduledAt: true,
          status: true,
          amountNet: true,
          patientOrigin: true,
          quantity: true,
        },
        orderBy: { scheduledAt: "asc" },
      });

      const items = orders.map((o) => {
        const paidFlag = o.amountNet.toNumber() > 0;
        const status =
          o.status === "NO_SHOW"
            ? "NO_SHOW"
            : o.status === "CANCELLED"
              ? "CANCELLED"
              : o.status === "COMPLETED"
                ? "COMPLETED"
                : "PENDING";

        return {
          procedure: { code: o.procedureCode, name: o.procedureName },
          procedureDate: o.scheduledAt.toISOString(),
          status,
          paid: paidFlag ? "paid" : "free",
          origin: o.patientOrigin,
          quantity: o.quantity,
          totalAmount: o.amountNet.toNumber(),
        };
      });

      return jsonOk({ view, items });
    }

    if (view === "doctor-bonus") {
      const doctorId = await resolveDoctorPractitionerId();
      if (!doctorId) {
        return jsonOk({
          view,
          items: [],
          grandTotal: 0,
          grandTotalInHouse: 0,
          grandTotalWalkIn: 0,
        });
      }

      const rows = await prisma.procedureOrder.findMany({
        where: {
          prescribedByPractitionerId: doctorId,
          status: "COMPLETED",
          bonusEligible: true,
          amountNet: { gt: 0 },
          completedAt: { gte: start, lt: end },
          ...(procedureQ ? { procedureCode: procedureQ } : {}),
        },
        select: {
          procedureCode: true,
          procedureName: true,
          quantity: true,
          amountNet: true,
          patientOrigin: true,
        },
      });

      const byCode = new Map<
        string,
        {
          procedureCode: string;
          procedureName: string;
          quantity: number;
          totalAmount: number;
        }
      >();

      let grandTotalInHouse = 0;
      let grandTotalWalkIn = 0;

      for (const r of rows) {
        const amt = r.amountNet.toNumber();
        if (r.patientOrigin === "IN_HOUSE") grandTotalInHouse += amt;
        else grandTotalWalkIn += amt;

        const key = r.procedureCode;
        const existing = byCode.get(key);
        if (!existing) {
          byCode.set(key, {
            procedureCode: key,
            procedureName: r.procedureName,
            quantity: r.quantity,
            totalAmount: amt,
          });
        } else {
          existing.quantity += r.quantity;
          existing.totalAmount += amt;
        }
      }

      const items = [...byCode.values()].map((g) => ({
        procedure: { code: g.procedureCode, name: g.procedureName },
        quantity: g.quantity,
        price: g.quantity > 0 ? g.totalAmount / g.quantity : 0,
        totalAmount: g.totalAmount,
      }));
      const grandTotal = grandTotalInHouse + grandTotalWalkIn;
      const { getClinicSettings } = await import("@/domain/settings/settings.service");
      const { applyBonusPercents } = await import("@/lib/doctor-bonus");
      const settings = await getClinicSettings();
      const percentInHouse = settings.doctorBonusPercentInHouse ?? 0;
      const percentWalkIn = settings.doctorBonusPercentWalkIn ?? 0;
      const bonuses = applyBonusPercents({
        grandTotalInHouse,
        grandTotalWalkIn,
        percentInHouse,
        percentWalkIn,
      });
      return jsonOk({
        view,
        items,
        grandTotal,
        grandTotalInHouse,
        grandTotalWalkIn,
        doctorBonusPercentInHouse: percentInHouse,
        doctorBonusPercentWalkIn: percentWalkIn,
        bonusInHouse: bonuses.bonusInHouse,
        bonusWalkIn: bonuses.bonusWalkIn,
        bonusTotal: bonuses.bonusTotal,
      });
    }

    if (view === "by-procedure") {
      const statusesForAssigned = ["PROPOSED", "SCHEDULED", "CHECKED_IN", "COMPLETED"] as const;
      const rows = await prisma.procedureOrder.findMany({
        where: {
          scheduledAt: { gte: start, lt: end },
          status: { in: statusesForAssigned as any },
          ...(procedureQ ? { procedureCode: procedureQ } : {}),
        },
        select: {
          procedureCode: true,
          procedureName: true,
          status: true,
        },
      });

      const byCode = new Map<
        string,
        { procedureCode: string; procedureName: string; assignedCount: number; completedCount: number }
      >();

      for (const r of rows) {
        const key = r.procedureCode;
        const existing =
          byCode.get(key) ??
          ((): {
            procedureCode: string;
            procedureName: string;
            assignedCount: number;
            completedCount: number;
          } => {
            const v = {
              procedureCode: key,
              procedureName: r.procedureName,
              assignedCount: 0,
              completedCount: 0,
            };
            byCode.set(key, v);
            return v;
          })();
        existing.assignedCount += 1;
        if (r.status === "COMPLETED") existing.completedCount += 1;
      }

      const items = [...byCode.values()].sort((a, b) => b.assignedCount - a.assignedCount);
      return jsonOk({ view, items });
    }

    // nurse-work
    const isNurseDesk = sessionHasClinicPermission(
      session,
      CLINIC_PERMISSION.SCREEN_NURSE,
    );
    const nursePractitionerId = isNurseDesk
      ? (
          await prisma.practitioner.findFirst({
            where: { userId: session.sub },
            select: { id: true },
          })
        )?.id
      : nurseIdParam ?? null;

    if (isNurseDesk && !nursePractitionerId) {
      return jsonOk({ view, items: [], grandTotal: 0 });
    }

    const hasNurseFilter = nursePractitionerId != null;

    const allocations = await prisma.procedureAllocation.findMany({
      where: {
        role: "STAFF",
        ...(hasNurseFilter ? { practitionerId: nursePractitionerId! } : {}),
        procedureOrder: {
          status: "COMPLETED",
          scheduledAt: { gte: start, lt: end },
        },
      },
      select: {
        practitionerId: true,
        procedureOrder: {
          select: {
            procedureCode: true,
            procedureName: true,
            scheduledAt: true,
            quantity: true,
          },
        },
      },
    });

    const byKey = new Map<
      string,
      { ymd: string; procedureCode: string; procedureName: string; quantity: number }
    >();

    for (const a of allocations) {
      const ymd = formatBakuYmd(a.procedureOrder.scheduledAt);
      const key = `${ymd}:${a.procedureOrder.procedureCode}`;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          ymd,
          procedureCode: a.procedureOrder.procedureCode,
          procedureName: a.procedureOrder.procedureName,
          quantity: a.procedureOrder.quantity,
        });
      } else {
        existing.quantity += a.procedureOrder.quantity;
      }
    }

    const items = [...byKey.values()].sort((a, b) => (a.ymd > b.ymd ? 1 : -1));
    const grandTotal = items.reduce((sum, i) => sum + i.quantity, 0);
    return jsonOk({ view, items, grandTotal });
  } catch (err) {
    return handleRouteError(err);
  }
}

