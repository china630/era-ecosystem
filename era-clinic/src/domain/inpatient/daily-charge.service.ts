import { prisma } from "@/lib/prisma";
import { SATELLITE_CLINIC_WARD_DAY_CHARGE } from "@era/contracts";
import { dispatchSatelliteEvent } from "@/lib/dispatch-satellite-event";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function postDailyWardCharges(chargeDate: Date = new Date()) {
  const day = startOfDay(chargeDate);
  const dayIso = day.toISOString().slice(0, 10);

  const admissions = await prisma.inpatientAdmission.findMany({
    where: {
      status: "ADMITTED",
      admittedAt: { lte: day },
      OR: [{ dischargedAt: null }, { dischargedAt: { gt: day } }],
    },
    include: {
      patient: true,
      dailyCharges: { where: { chargeDate: day }, take: 1 },
      assignments: {
        where: { dischargedAt: null },
        take: 1,
        include: {
          bed: { include: { ward: true } },
        },
      },
    },
  });

  let posted = 0;
  for (const admission of admissions) {
    if (admission.dailyCharges.length > 0) continue;

    const assignment = admission.assignments[0];
    if (!assignment?.bed?.ward) continue;

    const serviceCode =
      assignment.bed.ward.dailyChargeCode?.trim() || `WARD-DAY-${assignment.bed.ward.code}`;
    const amountNet = 50;

    await dispatchSatelliteEvent({
      type: SATELLITE_CLINIC_WARD_DAY_CHARGE,
      globalPersonId: admission.patient.globalPersonId ?? undefined,
      payload: {
        admissionId: admission.id,
        patientRef: admission.patient.refCode,
        wardCode: assignment.bed.ward.code,
        bedCode: assignment.bed.code,
        chargeDate: dayIso,
        serviceCode,
        amountNet,
        currency: "AZN",
      },
    });

    await prisma.inpatientDailyCharge.create({
      data: {
        admissionId: admission.id,
        chargeDate: day,
      },
    });

    posted++;
  }

  return { chargeDate: dayIso, scanned: admissions.length, posted };
}
