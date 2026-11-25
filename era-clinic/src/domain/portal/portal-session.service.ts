import { prisma } from "@/lib/prisma";

export type PortalLabResultLine = {
  code: string;
  name?: string | null;
  value: string;
  unit?: string | null;
  flag?: string | null;
};

export type PortalLabOrderResult = {
  id: string;
  testCode: string;
  publishedAt: string | null;
  completedAt: string | null;
  results: PortalLabResultLine[];
};

export type PortalAppointmentSummary = {
  id: string;
  scheduledAt: string;
  status: string;
  mode: string;
  videoRoomUrl: string | null;
  practitionerName: string;
  durationMinutes: number;
};

export async function findPatientRefsByGlobalPersonId(globalPersonId: string) {
  return prisma.patientRef.findMany({
    where: { globalPersonId },
    select: { id: true, organizationId: true, fullName: true },
  });
}

export async function listPublishedPortalLabResults(patientRefIds: string[]): Promise<PortalLabOrderResult[]> {
  const orders = await prisma.labOrder.findMany({
    where: {
      patientRefId: { in: patientRefIds },
      status: "COMPLETED",
      publishedAt: { not: null },
    },
    select: {
      id: true,
      testCode: true,
      completedAt: true,
      publishedAt: true,
      resultJson: true,
      items: {
        select: {
          results: {
            select: {
              code: true,
              label: true,
              value: true,
              unit: true,
              flag: true,
            },
            orderBy: { code: "asc" },
          },
        },
      },
    },
    orderBy: { completedAt: "desc" },
    take: 20,
  });

  return orders.map((order) => {
    const fromRows: PortalLabResultLine[] = order.items.flatMap((item) =>
      item.results.map((r) => ({
        code: r.code,
        name: r.label,
        value: r.value,
        unit: r.unit,
        flag: r.flag,
      })),
    );
    let results = fromRows;
    if (results.length === 0 && order.resultJson) {
      try {
        const parsed = JSON.parse(order.resultJson) as Array<{
          code?: string;
          name?: string;
          value?: string;
          unit?: string;
          flag?: string;
        }>;
        if (Array.isArray(parsed)) {
          results = parsed
            .filter((row) => row.code && row.value)
            .map((row) => ({
              code: row.code!,
              name: row.name ?? row.code,
              value: row.value!,
              unit: row.unit ?? null,
              flag: row.flag ?? null,
            }));
        }
      } catch {
        /* legacy malformed snapshot */
      }
    }
    return {
      id: order.id,
      testCode: order.testCode,
      publishedAt: order.publishedAt?.toISOString() ?? null,
      completedAt: order.completedAt?.toISOString() ?? null,
      results,
    };
  });
}

/** Upcoming and recent appointments for entitled patient refs (read-only portal). */
export async function listPortalAppointments(
  patientRefIds: string[],
  organizationIds: string[],
): Promise<PortalAppointmentSummary[]> {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const rows = await prisma.appointment.findMany({
    where: {
      patientRefId: { in: patientRefIds },
      organizationId: { in: organizationIds },
      status: { notIn: ["CANCELLED"] },
      scheduledAt: { gte: from },
    },
    select: {
      id: true,
      scheduledAt: true,
      status: true,
      mode: true,
      videoRoomUrl: true,
      durationMinutes: true,
      practitioner: { select: { fullName: true } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 30,
  });
  return rows.map((row) => ({
    id: row.id,
    scheduledAt: row.scheduledAt.toISOString(),
    status: row.status,
    mode: row.mode,
    videoRoomUrl: row.videoRoomUrl,
    practitionerName: row.practitioner.fullName,
    durationMinutes: row.durationMinutes,
  }));
}