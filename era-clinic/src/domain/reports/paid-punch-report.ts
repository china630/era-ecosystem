import { prisma } from "@/lib/prisma";
import { bakuDayBounds } from "@/lib/baku-day";

export type PaidPunchKind = "procedure" | "lab" | "diagnostic";

export type PaidPunchRow = {
  id: string;
  kind: PaidPunchKind;
  ymd: string;
  code: string;
  name: string;
  room: string;
  guest: string;
  doctor: string;
  cashier: string;
  amount: number;
};

export type PaidPunchQuery = {
  from: string;
  to: string;
  kind?: PaidPunchKind | "";
  room?: string;
  guest?: string;
  code?: string;
  doctorId?: string;
  cashierId?: string;
  locale?: string;
};

function bakuYmd(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Baku",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function money(value: { toNumber(): number } | number): number {
  const n = typeof value === "number" ? value : value.toNumber();
  return Math.round(n * 100) / 100;
}

export async function loadPaidPunchReport(query: PaidPunchQuery): Promise<{
  items: PaidPunchRow[];
  grandTotal: number;
}> {
  const { start } = bakuDayBounds(query.from);
  const { end } = bakuDayBounds(query.to);
  const room = query.room?.trim() || "";
  const guest = query.guest?.trim() || "";
  const code = query.code?.trim() || "";
  const doctorId = query.doctorId?.trim() || "";
  const cashierId = query.cashierId?.trim() || "";
  const kind = query.kind || "";
  const locale = query.locale === "ru" || query.locale === "az" ? query.locale : "en";

  const guestWhere = guest
    ? { fullName: { contains: guest, mode: "insensitive" as const } }
    : undefined;
  const roomWhere = room
    ? { roomNumber: { contains: room, mode: "insensitive" as const } }
    : undefined;

  const [procedures, labs, visits] = await Promise.all([
    kind === "lab" || kind === "diagnostic"
      ? Promise.resolve([])
      : prisma.procedureOrder.findMany({
          where: {
            inPackage: false,
            amountNet: { gt: 0 },
            paymentReceiptRef: { not: null },
            status: { not: "CANCELLED" },
            ...(code ? { procedureCode: code } : {}),
            ...(doctorId ? { prescribedByPractitionerId: doctorId } : {}),
            ...(cashierId ? { paidByUserId: cashierId } : {}),
            ...(guestWhere ? { patientRef: guestWhere } : {}),
            ...(roomWhere ? { clinicalEpisode: roomWhere } : {}),
            OR: [
              { paidAt: { gte: start, lt: end } },
              { paidAt: null, scheduledAt: { gte: start, lt: end } },
            ],
          },
          select: {
            id: true,
            procedureCode: true,
            procedureName: true,
            amountNet: true,
            quantity: true,
            paidAt: true,
            scheduledAt: true,
            paidByUserId: true,
            patientRef: { select: { fullName: true } },
            prescribedByPractitioner: { select: { fullName: true } },
            clinicalEpisode: { select: { roomNumber: true } },
          },
        }),
    kind === "procedure"
      ? Promise.resolve([])
      : prisma.labOrder.findMany({
          where: {
            inPackage: false,
            amountNet: { gt: 0 },
            status: { not: "CANCELLED" },
            ...(doctorId ? { prescribedByPractitionerId: doctorId } : {}),
            ...(cashierId ? { paidByUserId: cashierId } : {}),
            ...(guestWhere ? { patientRef: guestWhere } : {}),
            AND: [
              {
                OR: [
                  { paidAt: { gte: start, lt: end } },
                  { paidAt: null, settledAt: { gte: start, lt: end } },
                ],
              },
              ...(room
                ? [
                    {
                      OR: [
                        { roomNumber: { contains: room, mode: "insensitive" as const } },
                        { episode: roomWhere },
                      ],
                    },
                  ]
                : []),
            ],
          },
          select: {
            id: true,
            testCode: true,
            amountNet: true,
            paidAt: true,
            settledAt: true,
            roomNumber: true,
            paidByUserId: true,
            patientRef: { select: { fullName: true } },
            prescribedByPractitioner: { select: { fullName: true } },
            episode: { select: { roomNumber: true } },
            items: {
              orderBy: { sortOrder: "asc" },
              take: 1,
              select: { serviceCode: true },
            },
          },
        }),
    kind === "procedure" || kind === "lab"
      ? Promise.resolve([])
      : prisma.visit.findMany({
          where: {
            amountNet: { gt: 0 },
            status: { not: "CANCELLED" },
            ...(doctorId ? { practitionerId: doctorId } : {}),
            ...(cashierId ? { paidByUserId: cashierId } : {}),
            ...(guestWhere ? { patientRef: guestWhere } : {}),
            AND: [
              {
                OR: [
                  { paidAt: { gte: start, lt: end } },
                  { paidAt: null, settledAt: { gte: start, lt: end } },
                ],
              },
              ...(room
                ? [
                    {
                      OR: [
                        { roomNumber: { contains: room, mode: "insensitive" as const } },
                        { clinicalEpisode: roomWhere },
                      ],
                    },
                  ]
                : []),
            ],
          },
          select: {
            id: true,
            amountNet: true,
            paidAt: true,
            settledAt: true,
            roomNumber: true,
            paidByUserId: true,
            patientRef: { select: { fullName: true } },
            practitioner: { select: { fullName: true } },
            clinicalEpisode: { select: { roomNumber: true } },
            serviceLines: {
              where: { inPackage: false, amount: { gt: 0 } },
              take: 1,
              select: { serviceCode: true, description: true, amount: true },
            },
          },
        }),
  ]);

  const serviceCodes = [
    ...labs.map((row) => row.items[0]?.serviceCode || row.testCode),
    ...visits.map((row) => row.serviceLines[0]?.serviceCode || ""),
  ].filter(Boolean);
  const services = serviceCodes.length
    ? await prisma.diagnosticService.findMany({
        where: {
          OR: [
            { code: { in: [...new Set(serviceCodes)] } },
            { serviceCode: { in: [...new Set(serviceCodes)] } },
          ],
        },
        select: {
          code: true,
          serviceCode: true,
          titleEn: true,
          titleRu: true,
          titleAz: true,
          modality: { select: { kind: true } },
        },
      })
    : [];
  const serviceByCode = new Map<string, (typeof services)[number]>();
  for (const row of services) {
    serviceByCode.set(row.code, row);
    if (row.serviceCode) serviceByCode.set(row.serviceCode, row);
  }
  const titleOf = (serviceCode: string, fallback: string) => {
    const row = serviceByCode.get(serviceCode);
    if (!row) return fallback || serviceCode;
    if (locale === "ru") return row.titleRu || row.titleEn;
    if (locale === "az") return row.titleAz || row.titleEn;
    return row.titleEn;
  };

  const cashierIds = [
    ...procedures.map((row) => row.paidByUserId),
    ...labs.map((row) => row.paidByUserId),
    ...visits.map((row) => row.paidByUserId),
  ].filter((id): id is string => Boolean(id));
  const users = cashierIds.length
    ? await prisma.user.findMany({
        where: { id: { in: [...new Set(cashierIds)] } },
        select: { id: true, fullName: true, login: true },
      })
    : [];
  const cashierName = new Map(users.map((row) => [row.id, row.fullName?.trim() || row.login]));

  const rows: PaidPunchRow[] = [];

  for (const row of procedures) {
    const when = row.paidAt ?? row.scheduledAt;
    rows.push({
      id: row.id,
      kind: "procedure",
      ymd: bakuYmd(when),
      code: row.procedureCode,
      name: row.procedureName,
      room: row.clinicalEpisode?.roomNumber ?? "",
      guest: row.patientRef.fullName,
      doctor: row.prescribedByPractitioner?.fullName ?? "",
      cashier: row.paidByUserId ? cashierName.get(row.paidByUserId) ?? "" : "",
      amount: money(row.amountNet),
    });
  }

  for (const row of labs) {
    const serviceCode = row.items[0]?.serviceCode || row.testCode.split(",")[0] || row.testCode;
    if (code && serviceCode !== code && row.testCode !== code) continue;
    const modality = serviceByCode.get(serviceCode)?.modality.kind?.toUpperCase();
    const lineKind: PaidPunchKind =
      modality === "LAB" || (!modality && serviceCode.toUpperCase().startsWith("LAB"))
        ? "lab"
        : "diagnostic";
    if (kind && kind !== lineKind) continue;
    const when = row.paidAt ?? row.settledAt;
    if (!when) continue;
    rows.push({
      id: row.id,
      kind: lineKind,
      ymd: bakuYmd(when),
      code: serviceCode,
      name: titleOf(serviceCode, serviceCode),
      room: row.roomNumber || row.episode?.roomNumber || "",
      guest: row.patientRef.fullName,
      doctor: row.prescribedByPractitioner?.fullName ?? "",
      cashier: row.paidByUserId ? cashierName.get(row.paidByUserId) ?? "" : "",
      amount: money(row.amountNet),
    });
  }

  for (const row of visits) {
    const line = row.serviceLines[0];
    if (!line) continue;
    if (code && line.serviceCode !== code) continue;
    const when = row.paidAt ?? row.settledAt;
    if (!when) continue;
    rows.push({
      id: row.id,
      kind: "diagnostic",
      ymd: bakuYmd(when),
      code: line.serviceCode,
      name: titleOf(line.serviceCode, line.description),
      room: row.roomNumber || row.clinicalEpisode?.roomNumber || "",
      guest: row.patientRef.fullName,
      doctor: row.practitioner.fullName ?? "",
      cashier: row.paidByUserId ? cashierName.get(row.paidByUserId) ?? "" : "",
      amount: money(row.amountNet),
    });
  }

  rows.sort((a, b) => a.ymd.localeCompare(b.ymd) || a.guest.localeCompare(b.guest));
  const grandTotal = Math.round(rows.reduce((sum, row) => sum + row.amount, 0) * 100) / 100;
  return { items: rows, grandTotal };
}
