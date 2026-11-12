import { ProcedureOrderStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { bakuDayBounds } from "@/lib/baku-day";

function formatBakuYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export type ProcedureReportView =
  | "fulfillment"
  | "doctor-lines"
  | "doctor-bonus"
  | "by-procedure"
  | "nurse-work";

export type ProcedureReportInput = {
  view: ProcedureReportView;
  from: string;
  to: string;
  procedureCode?: string;
  paid?: string;
  origin?: string;
  doctorId?: string;
  nurseId?: string;
  statusFilter?: string;
  sessionUserId: string;
  isNurseDesk: boolean;
};

async function linkedDoctorForSession(sessionUserId: string) {
  return prisma.practitioner.findFirst({
    where: { userId: sessionUserId, active: true },
    select: { id: true, staffKind: true },
  });
}

export async function listProcedureReportDoctors(organizationId: string) {
  const rows = await prisma.practitioner.findMany({
    where: {
      organizationId,
      staffKind: "DOCTOR",
      active: true,
    },
    select: { id: true, fullName: true, code: true },
    orderBy: { fullName: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName?.trim() || row.code,
  }));
}

export async function runProcedureReport(input: ProcedureReportInput) {
  const { start } = bakuDayBounds(input.from);
  const { end } = bakuDayBounds(input.to);
  const procedureQ = input.procedureCode;

  const linkedDoctor = await linkedDoctorForSession(input.sessionUserId);
  const selfDoctorId = linkedDoctor?.staffKind === "DOCTOR" ? linkedDoctor.id : null;

  const resolveDoctorPractitionerId = (): string | null => {
    if (selfDoctorId) return selfDoctorId;
    return input.doctorId ?? null;
  };

  const view = input.view;

  if (view === "fulfillment") {
    const doctorId = resolveDoctorPractitionerId();
    const assignedStatuses: ProcedureOrderStatus[] = [
      "PENDING_PAY",
      "PROPOSED",
      "SCHEDULED",
      "CHECKED_IN",
      "COMPLETED",
      "NO_SHOW",
      "UNPAID_MISSED",
    ];
    const orders = await prisma.procedureOrder.findMany({
      where: {
        ...(doctorId ? { prescribedByPractitionerId: doctorId } : {}),
        ...(procedureQ ? { procedureCode: procedureQ } : {}),
        OR: [
          {
            scheduledAt: { gte: start, lt: end },
            status: { in: assignedStatuses },
          },
          {
            status: "COMPLETED",
            completedAt: { gte: start, lt: end },
          },
        ],
      },
      select: {
        procedureCode: true,
        procedureName: true,
        status: true,
        inPackage: true,
        amountNet: true,
        quantity: true,
        scheduledAt: true,
        completedAt: true,
      },
    });

    const byCode = new Map<
      string,
      {
        code: string;
        name: string;
        packageAssigned: number;
        packageCompleted: number;
        extraAssigned: number;
        extraCompleted: number;
        extraAmount: number;
      }
    >();

    for (const order of orders) {
      const row = byCode.get(order.procedureCode) ?? {
        code: order.procedureCode,
        name: order.procedureName,
        packageAssigned: 0,
        packageCompleted: 0,
        extraAssigned: 0,
        extraCompleted: 0,
        extraAmount: 0,
      };
      byCode.set(order.procedureCode, row);
      const qty = order.quantity || 1;
      const assignedHere =
        order.scheduledAt >= start &&
        order.scheduledAt < end &&
        assignedStatuses.includes(order.status);
      const completedHere =
        order.status === "COMPLETED" &&
        order.completedAt != null &&
        order.completedAt >= start &&
        order.completedAt < end;
      if (order.inPackage) {
        if (assignedHere) row.packageAssigned += qty;
        if (completedHere) row.packageCompleted += qty;
      } else {
        if (assignedHere) row.extraAssigned += qty;
        if (completedHere) {
          row.extraCompleted += qty;
          const amount = order.amountNet.toNumber();
          if (amount > 0) row.extraAmount = Math.round((row.extraAmount + amount) * 100) / 100;
        }
      }
    }

    const items = [...byCode.values()]
      .filter(
        (row) =>
          row.packageAssigned +
            row.packageCompleted +
            row.extraAssigned +
            row.extraCompleted >
          0,
      )
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((row) => ({
        procedure: { code: row.code, name: row.name },
        packageAssigned: row.packageAssigned,
        packageCompleted: row.packageCompleted,
        extraAssigned: row.extraAssigned,
        extraCompleted: row.extraCompleted,
        extraAmount: row.extraAmount,
      }));
    const extraAmount = items.reduce((sum, row) => sum + row.extraAmount, 0);
    return { view, items, grandTotal: Math.round(extraAmount * 100) / 100 };
  }

  if (view === "doctor-lines") {
    const doctorId = resolveDoctorPractitionerId();
    const statusFilter = input.statusFilter?.trim().toUpperCase() || "ALL";

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

    const statuses = statusToDb(statusFilter === "ALL" ? null : statusFilter);
    const paid = input.paid?.trim();

    const orders = await prisma.procedureOrder.findMany({
      where: {
        ...(doctorId ? { prescribedByPractitionerId: doctorId } : {}),
        scheduledAt: { gte: start, lt: end },
        status: { in: [...statuses] },
        ...(procedureQ ? { procedureCode: procedureQ } : {}),
        ...(input.origin ? { patientOrigin: input.origin as "WALK_IN" | "IN_HOUSE" } : {}),
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
        prescribedByPractitioner: { select: { fullName: true } },
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
        doctorName: o.prescribedByPractitioner?.fullName ?? "",
      };
    });

    return { view, items };
  }

  if (view === "doctor-bonus") {
    const doctorId = resolveDoctorPractitionerId();

    const rows = await prisma.procedureOrder.findMany({
      where: {
        ...(doctorId ? { prescribedByPractitionerId: doctorId } : {}),
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
    return {
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
    };
  }

  if (view === "by-procedure") {
    const statusesForAssigned = ["PROPOSED", "SCHEDULED", "CHECKED_IN", "COMPLETED"] as const;
    const rows = await prisma.procedureOrder.findMany({
      where: {
        scheduledAt: { gte: start, lt: end },
        status: { in: statusesForAssigned as unknown as ProcedureOrderStatus[] },
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

    const items = [...byCode.values()]
      .sort((a, b) => b.assignedCount - a.assignedCount)
      .map((g) => ({
        procedure: { code: g.procedureCode, name: g.procedureName },
        procedureCode: g.procedureCode,
        procedureName: g.procedureName,
        assignedCount: g.assignedCount,
        completedCount: g.completedCount,
      }));
    return { view, items };
  }

  const nursePractitionerId = input.isNurseDesk
    ? (
        await prisma.practitioner.findFirst({
          where: { userId: input.sessionUserId },
          select: { id: true },
        })
      )?.id
    : (input.nurseId ?? null);

  if (input.isNurseDesk && !nursePractitionerId) {
    return { view, items: [], grandTotal: 0 };
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
  return { view, items, grandTotal };
}

export async function listPaidPunchCashiers(organizationId: string) {
  const [procedures, labs, visits] = await Promise.all([
    prisma.procedureOrder.findMany({
      where: { paidByUserId: { not: null } },
      select: { paidByUserId: true },
      distinct: ["paidByUserId"],
    }),
    prisma.labOrder.findMany({
      where: { paidByUserId: { not: null } },
      select: { paidByUserId: true },
      distinct: ["paidByUserId"],
    }),
    prisma.visit.findMany({
      where: { paidByUserId: { not: null } },
      select: { paidByUserId: true },
      distinct: ["paidByUserId"],
    }),
  ]);
  const ids = [
    ...procedures.map((row) => row.paidByUserId),
    ...labs.map((row) => row.paidByUserId),
    ...visits.map((row) => row.paidByUserId),
  ].filter((id): id is string => Boolean(id));
  if (ids.length === 0) return [];
  const rows = await prisma.user.findMany({
    where: { id: { in: [...new Set(ids)] }, organizationId },
    select: { id: true, fullName: true, login: true },
    orderBy: { fullName: "asc" },
  });
  return rows.map((row) => ({
    id: row.id,
    fullName: row.fullName?.trim() || row.login,
  }));
}
