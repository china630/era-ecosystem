import { prisma } from "@/lib/prisma";

export type ProcedureOrderCard = {
  id: string;
  patientName: string;
  patientRefId: string;
  patientRefCode: string;
  roomNumber: string | null;
  procedureName: string;
  procedureCode: string;
  status: string;
  scheduledAt: string;
  endsAt: string | null;
  durationMinutes: number;
  cabinName: string | null;
  cabinCode: string | null;
  staffName: string | null;
  inPackage: boolean;
  amountNet: number;
  /** 1-based place among this episode's same procedure, and the count. */
  quotaIndex: number | null;
  quotaTotal: number | null;
};

export async function getProcedureOrderCard(
  orderId: string,
): Promise<ProcedureOrderCard | null> {
  const order = await prisma.procedureOrder.findUnique({
    where: { id: orderId },
    include: {
      patientRef: { select: { id: true, fullName: true, refCode: true } },
      clinicalEpisode: { select: { id: true, roomNumber: true } },
      resource: { select: { name: true, code: true } },
      allocations: {
        where: { role: "STAFF" },
        select: { practitioner: { select: { fullName: true } } },
        take: 1,
      },
    },
  });
  if (!order) return null;

  const start = order.scheduledAt.getTime();
  const end = order.endsAt?.getTime();
  const durationMinutes =
    end != null && end > start ? Math.round((end - start) / 60_000) : 0;

  let quotaIndex: number | null = null;
  let quotaTotal: number | null = null;
  if (order.clinicalEpisodeId) {
    const siblings = await prisma.procedureOrder.findMany({
      where: {
        clinicalEpisodeId: order.clinicalEpisodeId,
        procedureCode: order.procedureCode,
        status: { notIn: ["CANCELLED"] },
      },
      select: { id: true, scheduledAt: true },
      orderBy: { scheduledAt: "asc" },
    });
    quotaTotal = siblings.length;
    const idx = siblings.findIndex((row) => row.id === order.id);
    quotaIndex = idx >= 0 ? idx + 1 : null;
  }

  const staffName = order.allocations[0]?.practitioner?.fullName?.trim() || null;

  return {
    id: order.id,
    patientName: order.patientRef.fullName,
    patientRefId: order.patientRef.id,
    patientRefCode: order.patientRef.refCode,
    roomNumber: order.clinicalEpisode?.roomNumber ?? null,
    procedureName: order.procedureName,
    procedureCode: order.procedureCode,
    status: order.status,
    scheduledAt: order.scheduledAt.toISOString(),
    endsAt: order.endsAt?.toISOString() ?? null,
    durationMinutes,
    cabinName: order.resource?.name ?? null,
    cabinCode: order.resource?.code ?? null,
    staffName,
    inPackage: order.inPackage,
    amountNet: Number(order.amountNet),
    quotaIndex,
    quotaTotal,
  };
}
